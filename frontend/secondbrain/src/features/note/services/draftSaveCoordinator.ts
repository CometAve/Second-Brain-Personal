import { z } from 'zod';
import { deleteDraft, getDraft, saveDraft, saveToDatabase } from '@/api/client/draftApi';
import { deleteNotes } from '@/api/client/noteApi';
import { assertCurrentSession, isCurrentSession } from '@/stores/authStore';
import { isConflictError, isNotFoundError } from '@/shared/utils/typeGuards';
import type { NoteDraftResponse } from '@/shared/types/draft.types';

const SAVE_DELAY_MS = 500;
const PROMOTE_AFTER_WRITES = 50;
const PROMOTE_AFTER_MS = 5 * 60 * 1000;

const RECOVERY_SCHEMA = z.object({
  draftId: z.string(),
  ownerId: z.number().int().positive(),
  baseVersion: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  editedAt: z.number(),
});

type Recovery = z.infer<typeof RECOVERY_SCHEMA>;
type Snapshot = { title: string; content: string; revision: number };
export type DraftPhase = 'editing' | 'saving' | 'promoting' | 'deleting';
export type DraftCoordinatorStatus = { phase: DraftPhase; error: string | null };
export type CloseResult = { kind: 'promoted'; noteId: number } | { kind: 'draft' | 'empty' };

export class DraftSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftSaveError';
  }
}

/** One editor identity owns one ordered stream of versioned Redis writes. */
export class DraftSaveCoordinator {
  readonly draftId: string;
  readonly ownerId: number;
  readonly sessionEpoch: number;
  readonly initialMarkdown: string;
  private latest: Snapshot;
  private acknowledgedRevision: number;
  private version: number;
  private remoteExists: boolean;
  private writeAttempted = false;
  private writeUncertain = false;
  private lastAttempt: Snapshot | null = null;
  private lastAcknowledgedContent: { title: string; content: string };
  private promotionAttempted = false;
  private recoveryAvailable = false;
  private recoveryMatchesRemote = false;
  private recoveryBlocked = false;
  private recoveryKey: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private closing: Promise<CloseResult> | null = null;
  private deleting: Promise<void> | null = null;
  private discardCompleted = false;
  private completedNoteId: number | null = null;
  private disposed = false;
  private status: DraftCoordinatorStatus = { phase: 'editing', error: null };
  private onStatus: ((status: DraftCoordinatorStatus) => void) | null = null;
  private onAutomaticPromotion: (() => void) | null = null;
  private successfulWrites = 0;
  private lastPromotionAt = Date.now();

  constructor(
    draftId: string,
    ownerId: number,
    sessionEpoch: number,
    remote: NoteDraftResponse | null,
  ) {
    this.draftId = draftId;
    this.ownerId = ownerId;
    this.sessionEpoch = sessionEpoch;
    this.version = remote?.version ?? 1;
    this.remoteExists = remote !== null;
    this.lastAcknowledgedContent = { title: remote?.title ?? '', content: remote?.content ?? '' };
    this.recoveryKey = `sb:draft:recovery:v1:${ownerId}:${draftId}`;
    const recovery = this.readRecovery();
    const remoteMatchesRecovery =
      recovery !== null &&
      remote !== null &&
      recovery.title === remote.title &&
      recovery.content === remote.content;
    this.recoveryMatchesRemote = Boolean(remoteMatchesRecovery);
    this.recoveryAvailable = recovery !== null;

    if (recovery !== null && !remoteMatchesRecovery) {
      this.latest = { title: recovery.title, content: recovery.content, revision: 1 };
      this.acknowledgedRevision = 0;
      if (remote !== null && recovery.baseVersion !== remote.version) {
        this.recoveryBlocked = true;
        this.status.error =
          '서버 초안이 변경되었습니다. 복구한 내용을 확인한 뒤 새 초안에 옮겨 주세요.';
      }
    } else {
      this.latest = { title: remote?.title ?? '', content: remote?.content ?? '', revision: 0 };
      this.acknowledgedRevision = 0;
    }
    this.initialMarkdown = this.latest.content;
  }

  get snapshot(): Snapshot {
    return this.latest;
  }
  get currentVersion(): number {
    return this.version;
  }
  get currentStatus(): DraftCoordinatorStatus {
    return this.status;
  }
  get hasUnsafeChanges(): boolean {
    if (this.discardCompleted || !this.isDirty()) return false;
    const recovery = this.readRecovery();
    return (
      recovery === null ||
      recovery.title !== this.latest.title ||
      recovery.content !== this.latest.content
    );
  }

  /** A route change may retain the draft locally, but must not lose its only current copy. */
  async ensureSafeToLeave(): Promise<boolean> {
    if (!this.hasUnsafeChanges) return true;
    try {
      await this.saveLatest();
    } catch (error) {
      if (!this.hasUnsafeChanges) return true;
      this.report(error);
      return false;
    }
    if (!this.hasUnsafeChanges) return true;
    this.publish(
      'editing',
      '최신 입력을 서버나 브라우저 복구본에 저장하지 못했습니다. 화면을 유지하고 다시 시도해 주세요.',
    );
    return false;
  }

  attach(
    onStatus: (status: DraftCoordinatorStatus) => void,
    onAutomaticPromotion: () => void,
  ): void {
    this.disposed = false;
    this.onStatus = onStatus;
    this.onAutomaticPromotion = onAutomaticPromotion;
    if (this.recoveryMatchesRemote) {
      this.clearRecovery();
      this.recoveryMatchesRemote = false;
    }
    if (this.isDirty() && !this.recoveryBlocked) this.schedule();
    onStatus(this.status);
  }

  private publish(phase: DraftPhase, error: string | null = null): void {
    this.status = { phase, error };
    this.onStatus?.(this.status);
  }

  private readRecovery(): Recovery | null {
    try {
      const raw = localStorage.getItem(this.recoveryKey);
      if (raw === null) return null;
      const parsed = RECOVERY_SCHEMA.safeParse(JSON.parse(raw));
      if (!parsed.success) return null;
      return parsed.data.draftId === this.draftId && parsed.data.ownerId === this.ownerId
        ? parsed.data
        : null;
    } catch {
      return null;
    }
  }

  private writeRecovery(): void {
    const data: Recovery = {
      draftId: this.draftId,
      ownerId: this.ownerId,
      baseVersion: this.version,
      title: this.latest.title,
      content: this.latest.content,
      editedAt: Date.now(),
    };
    try {
      localStorage.setItem(this.recoveryKey, JSON.stringify(data));
      this.recoveryAvailable = true;
    } catch {
      this.recoveryAvailable = false;
      this.publish(
        this.status.phase,
        '브라우저에 복구본을 저장하지 못했습니다. 연결 상태를 확인해 주세요.',
      );
    }
  }

  private clearRecovery(): void {
    try {
      localStorage.removeItem(this.recoveryKey);
      this.recoveryAvailable = false;
    } catch {
      /* scoped recovery remains available */
    }
  }

  private isDirty(): boolean {
    return this.latest.revision > this.acknowledgedRevision;
  }

  editTitle(title: string): Snapshot {
    return this.edit({ title, content: this.latest.content });
  }
  editContent(content: string): Snapshot {
    return this.edit({ title: this.latest.title, content });
  }

  private edit(next: { title: string; content: string }): Snapshot {
    if (this.status.phase === 'deleting') return this.latest;
    if (next.title === this.latest.title && next.content === this.latest.content)
      return this.latest;
    this.latest = { ...next, revision: this.latest.revision + 1 };
    this.writeRecovery();
    if (!this.recoveryBlocked && this.closing === null && this.deleting === null) this.schedule();
    return this.latest;
  }

  private schedule(): void {
    this.cancelScheduled();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.saveLatest()
        .then(() => {
          if (
            !this.disposed &&
            this.status.phase === 'editing' &&
            (this.successfulWrites >= PROMOTE_AFTER_WRITES ||
              Date.now() - this.lastPromotionAt >= PROMOTE_AFTER_MS) &&
            this.latest.title.trim() &&
            this.latest.content.trim()
          ) {
            this.onAutomaticPromotion?.();
          }
        })
        .catch((error: unknown) => this.report(error));
    }, SAVE_DELAY_MS);
  }

  private cancelScheduled(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private report(error: unknown): void {
    if (!isCurrentSession(this.sessionEpoch)) return;
    const recoveryMessage = this.recoveryAvailable
      ? '최신 입력은 이 계정의 브라우저 복구본에 남아 있습니다.'
      : '브라우저 복구본도 확인되지 않았습니다. 입력 내용을 복사해 보관해 주세요.';
    const message =
      error instanceof DraftSaveError
        ? error.message
        : isConflictError(error)
          ? `초안 버전이나 처리 상태가 충돌했습니다. 최신 입력은 확정되지 않았습니다. ${recoveryMessage}`
          : `임시 저장에 실패했습니다. ${recoveryMessage}`;
    this.publish('editing', message);
  }

  async saveLatest(): Promise<void> {
    this.cancelScheduled();
    if (this.recoveryBlocked) throw new DraftSaveError(this.status.error ?? '초안 버전 충돌');
    if (this.writeUncertain) await this.resolveUncertainWrite();
    while (this.isDirty()) {
      if (this.saving !== null) {
        await this.saving;
        continue;
      }
      const submitted = this.latest;
      if (!submitted.title.trim() && !submitted.content.trim()) {
        if (!this.remoteExists) return;
        throw new DraftSaveError('빈 초안은 저장할 수 없습니다. 내용을 복구하거나 삭제해 주세요.');
      }
      const submittedVersion = this.version;
      const work = (async () => {
        assertCurrentSession(this.sessionEpoch);
        this.publish('saving');
        this.writeAttempted = true;
        this.lastAttempt = submitted;
        let saved;
        try {
          saved = await saveDraft(
            {
              noteId: this.draftId,
              title: submitted.title,
              content: submitted.content,
              version: submittedVersion,
            },
            { sessionEpoch: this.sessionEpoch },
          );
        } catch (error) {
          this.writeUncertain = true;
          throw error;
        }
        assertCurrentSession(this.sessionEpoch);
        if (
          saved.noteId !== this.draftId ||
          saved.version !== submittedVersion + (this.remoteExists ? 1 : 0) ||
          saved.title !== submitted.title ||
          saved.content !== submitted.content
        ) {
          this.writeUncertain = true;
          throw new DraftSaveError('서버 저장 확인이 일치하지 않습니다. 입력 내용을 보존했습니다.');
        }
        this.version = saved.version;
        this.remoteExists = true;
        this.writeUncertain = false;
        this.lastAcknowledgedContent = { title: saved.title, content: saved.content };
        this.acknowledgedRevision = submitted.revision;
        this.successfulWrites++;
        if (!this.isDirty()) this.clearRecovery();
        else this.writeRecovery();
        this.publish('editing');
      })();
      this.saving = work;
      try {
        await work;
      } finally {
        if (this.saving === work) this.saving = null;
      }
    }
  }

  private async resolveUncertainWrite(): Promise<void> {
    assertCurrentSession(this.sessionEpoch);
    let remote: NoteDraftResponse;
    try {
      remote = await getDraft(this.draftId, { sessionEpoch: this.sessionEpoch });
    } catch (error) {
      if (isNotFoundError(error) && !this.remoteExists) {
        this.writeUncertain = false;
        return;
      }
      throw error;
    }
    assertCurrentSession(this.sessionEpoch);
    const attempted = this.lastAttempt;
    const matchesAttempt =
      attempted !== null &&
      remote.title === attempted.title &&
      remote.content === attempted.content;
    const matchesLatest =
      remote.title === this.latest.title && remote.content === this.latest.content;
    const matchesAcknowledged =
      remote.version === this.version &&
      remote.title === this.lastAcknowledgedContent.title &&
      remote.content === this.lastAcknowledgedContent.content;
    if (!matchesAttempt && !matchesLatest && !matchesAcknowledged) {
      this.recoveryBlocked = true;
      throw new DraftSaveError(
        '서버 초안과 복구본이 다릅니다. 최신 입력을 자동으로 덮어쓰지 않았습니다.',
      );
    }
    this.version = remote.version;
    this.remoteExists = true;
    this.lastAcknowledgedContent = { title: remote.title, content: remote.content };
    if (matchesLatest) this.acknowledgedRevision = this.latest.revision;
    else if (matchesAttempt && attempted !== null) this.acknowledgedRevision = attempted.revision;
    if (!this.isDirty()) this.clearRecovery();
    this.writeUncertain = false;
  }

  close(): Promise<CloseResult> {
    if (this.closing !== null) return this.closing;
    this.closing = this.closeOnce()
      .catch((error: unknown) => {
        this.report(error);
        throw error;
      })
      .finally(() => {
        this.closing = null;
      });
    return this.closing;
  }

  private async closeOnce(): Promise<CloseResult> {
    this.cancelScheduled();
    if (!this.latest.title.trim() && !this.latest.content.trim()) {
      await this.discardOnce();
      return { kind: 'empty' };
    }
    await this.saveLatest();
    assertCurrentSession(this.sessionEpoch);
    const submitted = this.latest;
    if (!submitted.title.trim() || !submitted.content.trim()) {
      return { kind: 'draft' };
    }
    this.publish('promoting');
    this.promotionAttempted = true;
    const promoted = await saveToDatabase(this.draftId, { sessionEpoch: this.sessionEpoch });
    assertCurrentSession(this.sessionEpoch);
    this.completedNoteId = promoted.noteId;
    if (
      this.latest.revision !== submitted.revision ||
      promoted.title !== submitted.title ||
      promoted.content !== submitted.content
    ) {
      this.writeRecovery();
      throw new DraftSaveError(
        '저장 중 내용이 변경되어 최신 입력을 확정하지 못했습니다. 현재 내용을 복사해 새 노트에 옮겨 주세요.',
      );
    }
    this.clearRecovery();
    this.lastPromotionAt = Date.now();
    return { kind: 'promoted', noteId: promoted.noteId };
  }

  discard(): Promise<void> {
    if (this.deleting !== null) return this.deleting;
    this.deleting = this.discardOnce()
      .catch((error: unknown) => {
        this.report(error);
        throw error;
      })
      .finally(() => {
        this.deleting = null;
      });
    return this.deleting;
  }

  private async discardOnce(): Promise<void> {
    this.cancelScheduled();
    this.publish('deleting');
    // A dispatched write can still reach Redis. Wait for it before the delete acknowledgement.
    if (this.saving !== null) {
      try {
        await this.saving;
      } catch {
        /* deletion still resolves the current draft ID */
      }
    }
    assertCurrentSession(this.sessionEpoch);
    if (this.promotionAttempted && this.completedNoteId === null) {
      throw new DraftSaveError(
        '노트 생성 결과를 확인할 수 없어 삭제하지 않았습니다. 잠시 후 저장을 다시 시도해 주세요.',
      );
    }
    if (this.completedNoteId !== null) {
      await deleteNotes([this.completedNoteId], { sessionEpoch: this.sessionEpoch });
    } else if (this.remoteExists || this.writeAttempted) {
      try {
        await deleteDraft(this.draftId, { sessionEpoch: this.sessionEpoch });
      } catch (error) {
        if (!isNotFoundError(error)) throw error;
      }
    }
    assertCurrentSession(this.sessionEpoch);
    this.clearRecovery();
    this.discardCompleted = true;
  }

  detach(): void {
    this.disposed = true;
    this.onStatus = null;
    this.onAutomaticPromotion = null;
    this.cancelScheduled();
    queueMicrotask(() => {
      if (
        this.disposed &&
        this.isDirty() &&
        !this.recoveryBlocked &&
        this.status.phase !== 'deleting' &&
        isCurrentSession(this.sessionEpoch)
      ) {
        void this.saveLatest().catch(() => {
          // The per-owner local recovery remains if the background write fails.
        });
      }
    });
  }
}
