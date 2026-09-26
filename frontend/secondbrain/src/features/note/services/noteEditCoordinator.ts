import { z } from 'zod';
import { getNote, updateNote } from '@/api/client/noteApi';
import { assertCurrentSession, isCurrentSession } from '@/stores/authStore';
import type { NoteResponse } from '@/shared/types/note.types';

const SAVE_DELAY_MS = 500;
const RECOVERY_SCHEMA = z.object({
  ownerId: z.number().int().positive(),
  noteId: z.number().int().positive(),
  baseTitle: z.string(),
  baseContent: z.string(),
  title: z.string(),
  content: z.string(),
});

type Snapshot = { title: string; content: string; revision: number };
export type NoteEditStatus = {
  phase: 'editing' | 'saving' | 'deleting';
  error: string | null;
  dirty: boolean;
};

/** A single hydrated note owns one ordered stream of PUT requests. */
export class NoteEditCoordinator {
  readonly initialMarkdown: string;
  private readonly noteId: number;
  private readonly ownerId: number;
  private readonly sessionEpoch: number;
  private latest: Snapshot;
  private acknowledgedRevision = 0;
  private acknowledged: { title: string; content: string };
  private readonly recoveryKey: string;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;
  private deleting = false;
  private blocked = false;
  private uncertain = false;
  private lastAttempt: Snapshot | null = null;
  private onStatus: ((status: NoteEditStatus) => void) | null = null;
  private onSaved: (() => void) | null = null;
  private status: NoteEditStatus = { phase: 'editing', error: null, dirty: false };

  constructor(noteId: number, ownerId: number, sessionEpoch: number, remote: NoteResponse) {
    this.noteId = noteId;
    this.ownerId = ownerId;
    this.sessionEpoch = sessionEpoch;
    this.acknowledged = { title: remote.title, content: remote.content };
    this.recoveryKey = `sb:note:recovery:v1:${ownerId}:${noteId}`;
    let recovered: z.infer<typeof RECOVERY_SCHEMA> | null = null;
    try {
      const raw = localStorage.getItem(this.recoveryKey);
      if (raw) {
        const parsed = RECOVERY_SCHEMA.safeParse(JSON.parse(raw));
        if (parsed.success && parsed.data.ownerId === ownerId && parsed.data.noteId === noteId) {
          recovered = parsed.data;
        }
      }
    } catch {
      // Storage may be unavailable; the live editor still preserves its state.
    }
    if (recovered && (recovered.title !== remote.title || recovered.content !== remote.content)) {
      this.latest = { title: recovered.title, content: recovered.content, revision: 1 };
      if (recovered.baseTitle !== remote.title || recovered.baseContent !== remote.content) {
        this.blocked = true;
        this.status = {
          phase: 'editing',
          dirty: true,
          error:
            '서버 노트가 다른 곳에서 변경되었습니다. 복구한 내용을 확인하고 복사해 보관해 주세요.',
        };
      } else {
        this.status = { phase: 'editing', error: null, dirty: true };
      }
    } else {
      this.latest = { title: remote.title, content: remote.content, revision: 0 };
      if (recovered) this.clearRecovery();
    }
    this.initialMarkdown = this.latest.content;
  }

  get snapshot(): Snapshot {
    return this.latest;
  }
  get currentStatus(): NoteEditStatus {
    return this.status;
  }
  get isDirty(): boolean {
    return this.latest.revision > this.acknowledgedRevision;
  }

  attach(onStatus: (status: NoteEditStatus) => void, onSaved: () => void): void {
    this.onStatus = onStatus;
    this.onSaved = onSaved;
    onStatus(this.status);
    if (this.isDirty && !this.blocked) this.schedule();
  }

  detach(): void {
    this.onStatus = null;
    this.onSaved = null;
    this.cancelScheduled();
    // A route transition is guarded by the page. The recovery copy survives a forced unmount.
  }

  private publish(phase: NoteEditStatus['phase'], error: string | null = null): void {
    this.status = { phase: this.deleting ? 'deleting' : phase, error, dirty: this.isDirty };
    this.onStatus?.(this.status);
  }

  private writeRecovery(): boolean {
    try {
      localStorage.setItem(
        this.recoveryKey,
        JSON.stringify({
          ownerId: this.ownerId,
          noteId: this.noteId,
          baseTitle: this.acknowledged.title,
          baseContent: this.acknowledged.content,
          title: this.latest.title,
          content: this.latest.content,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private clearRecovery(): void {
    try {
      localStorage.removeItem(this.recoveryKey);
    } catch {
      /* stale recovery is compared on next open */
    }
  }

  editTitle(title: string): Snapshot {
    return this.edit({ title, content: this.latest.content });
  }
  editContent(content: string): Snapshot {
    return this.edit({ title: this.latest.title, content });
  }

  private edit(next: { title: string; content: string }): Snapshot {
    if (this.deleting || (next.title === this.latest.title && next.content === this.latest.content))
      return this.latest;
    this.latest = { ...next, revision: this.latest.revision + 1 };
    const recoveryWritten = this.writeRecovery();
    if (!this.blocked) this.schedule();
    this.publish(
      this.status.phase,
      this.blocked
        ? this.status.error
        : recoveryWritten
          ? null
          : '브라우저 복구본을 저장하지 못했습니다. 입력 내용을 복사해 보관해 주세요.',
    );
    return this.latest;
  }

  private cancelScheduled(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    this.cancelScheduled();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.saveLatest().catch((error: unknown) => this.report(error));
    }, SAVE_DELAY_MS);
  }

  private validate(): void {
    if (!this.latest.title.trim())
      throw new Error('제목을 입력해야 기존 노트를 저장할 수 있습니다.');
    if (this.latest.title.length > 64) throw new Error('제목은 64자 이하여야 합니다.');
    if (!this.latest.content.trim())
      throw new Error('본문을 입력해야 기존 노트를 저장할 수 있습니다.');
  }

  private report(error: unknown): void {
    if (!isCurrentSession(this.sessionEpoch)) return;
    this.publish(
      'editing',
      error instanceof Error ? error.message : '노트를 저장하지 못했습니다. 다시 시도해 주세요.',
    );
  }

  private async resolveUncertain(): Promise<void> {
    assertCurrentSession(this.sessionEpoch);
    const remote = await getNote(this.noteId, { sessionEpoch: this.sessionEpoch });
    assertCurrentSession(this.sessionEpoch);
    const attempted = this.lastAttempt;
    const matchesLatest =
      remote.title === this.latest.title && remote.content === this.latest.content;
    const matchesAttempt =
      attempted && remote.title === attempted.title && remote.content === attempted.content;
    const matchesAcknowledged =
      remote.title === this.acknowledged.title && remote.content === this.acknowledged.content;
    if (!matchesLatest && !matchesAttempt && !matchesAcknowledged) {
      this.blocked = true;
      throw new Error(
        '서버 노트와 최신 입력이 달라 자동으로 덮어쓰지 않았습니다. 입력 내용을 복사해 보관해 주세요.',
      );
    }
    this.acknowledged = { title: remote.title, content: remote.content };
    if (matchesLatest) this.acknowledgedRevision = this.latest.revision;
    else if (matchesAttempt) this.acknowledgedRevision = attempted.revision;
    this.uncertain = false;
    if (!this.isDirty) this.clearRecovery();
  }

  async saveLatest(): Promise<void> {
    this.cancelScheduled();
    if (this.deleting) throw new Error('노트를 삭제하는 중입니다.');
    if (this.saving) {
      await this.saving;
      if (this.isDirty) return this.saveLatest();
      return;
    }
    const work = this.saveDrain();
    this.saving = work;
    try {
      await work;
    } finally {
      if (this.saving === work) this.saving = null;
    }
  }

  private async saveDrain(): Promise<void> {
    if (this.blocked) throw new Error(this.status.error ?? '서버 내용과 충돌했습니다.');
    if (this.uncertain) await this.resolveUncertain();
    while (this.isDirty && !this.deleting) {
      this.validate();
      const submitted = this.latest;
      assertCurrentSession(this.sessionEpoch);
      this.publish('saving');
      this.lastAttempt = submitted;
      let saved: NoteResponse;
      try {
        saved = await updateNote(this.noteId, submitted, { sessionEpoch: this.sessionEpoch });
      } catch (error) {
        this.uncertain = true;
        throw error;
      }
      assertCurrentSession(this.sessionEpoch);
      if (
        saved.noteId !== this.noteId ||
        saved.title !== submitted.title ||
        saved.content !== submitted.content
      ) {
        this.uncertain = true;
        throw new Error('서버 저장 확인이 일치하지 않습니다. 입력 내용을 보존했습니다.');
      }
      this.acknowledgedRevision = submitted.revision;
      this.acknowledged = { title: submitted.title, content: submitted.content };
      if (this.isDirty) this.writeRecovery();
      else this.clearRecovery();
      this.publish('editing');
      this.onSaved?.();
    }
  }

  async flush(): Promise<void> {
    try {
      await this.saveLatest();
    } catch (error) {
      this.report(error);
      throw error;
    }
  }

  async prepareDelete(): Promise<void> {
    this.cancelScheduled();
    this.deleting = true;
    this.publish('deleting');
    if (this.saving) {
      try {
        await this.saving;
      } catch {
        /* deletion supersedes that edit */
      }
    }
    assertCurrentSession(this.sessionEpoch);
  }

  deleteFailed(): void {
    this.deleting = false;
    this.publish('editing', '노트를 삭제하지 못했습니다. 다시 시도해 주세요.');
    if (this.isDirty && !this.blocked) this.schedule();
  }

  deleteSucceeded(): void {
    this.latest = { ...this.latest, revision: this.acknowledgedRevision };
    this.clearRecovery();
    this.deleting = false;
    this.publish('editing');
  }
}
