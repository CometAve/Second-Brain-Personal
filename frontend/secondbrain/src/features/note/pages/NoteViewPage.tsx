import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import type { RefObject } from 'react';
import type { NoteEditorHandle } from '@/features/note/components/NoteEditor';
import { useNavigate, useParams } from '@tanstack/react-router';
import { MainLayout } from '@/layouts/MainLayout';
import { SidePeekOverlay } from '@/features/note/components/SidePeekOverlay';
import { DraftToolbar } from '@/features/note/components/DraftToolbar';
import { EditorLoadingSurface } from '@/features/note/components/EditorLoadingSurface';
import { NoteTitleInput } from '@/features/note/components/NoteTitleInput';
import { GraphPanel } from '@/features/main/components/GraphPanel';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary';
import { useNoteQuery } from '@/features/note/hooks/useNoteQuery';
import { useNoteEdit } from '@/features/note/hooks/useNoteEdit';
import { noteDeleteRequest, useNoteDelete } from '@/features/note/hooks/useNoteDelete';
import { useGraphStore } from '@/features/main/stores/graphStore';
import { isCurrentSession, useAuthStore } from '@/stores/authStore';
import type { NoteResponse } from '@/shared/types/note.types';
import '@/shared/styles/custom-scrollbar.css';

// 무거운 컴포넌트 lazy loading (three.js, Milkdown 번들 분리)
const NoteEditor = lazy(() =>
  import('@/features/note/components/NoteEditor').then((m) => ({ default: m.NoteEditor })),
);

type ReadyNoteProps = {
  note: NoteResponse;
  noteId: number;
  ownerId: number;
  sessionEpoch: number;
  viewMode: 'full-screen' | 'side-peek';
  onToggleMode: () => void;
  onClose: () => void;
  closeRef: RefObject<(() => void) | null>;
  editorPhase: 'loading' | 'ready' | 'error';
  onEditorPhaseChange: (phase: 'ready' | 'error') => void;
};

function ReadyNote({
  note,
  noteId,
  ownerId,
  sessionEpoch,
  viewMode,
  onToggleMode,
  onClose,
  closeRef,
  editorPhase,
  onEditorPhaseChange,
}: ReadyNoteProps) {
  const editorRef = useRef<NoteEditorHandle | null>(null);
  const composingRef = useRef(false);
  const waitersRef = useRef<Array<() => void>>([]);
  const { mutateAsync: deleteNote, isPending: isDeleting } = useNoteDelete();
  const { title, initialMarkdown, status, changeTitle, changeContent, flush, coordinator } =
    useNoteEdit({
      noteId,
      ownerId,
      sessionEpoch,
      initialNote: note,
      beforeFlush: () =>
        composingRef.current
          ? new Promise<void>((resolve) => waitersRef.current.push(resolve))
          : Promise.resolve(),
    });

  async function close() {
    try {
      await flush();
      if (isCurrentSession(sessionEpoch)) onClose();
    } catch {
      // The editor remains open with its latest input and an inline error.
    }
  }

  async function remove() {
    if (isDeleting) return;
    try {
      if (composingRef.current)
        await new Promise<void>((resolve) => waitersRef.current.push(resolve));
      await coordinator.prepareDelete();
      await deleteNote(noteDeleteRequest([noteId]));
      coordinator.deleteSucceeded();
      if (isCurrentSession(sessionEpoch)) onClose();
    } catch {
      coordinator.deleteFailed();
    }
  }

  useEffect(() => {
    closeRef.current = () => {
      void flush()
        .then(() => {
          if (isCurrentSession(sessionEpoch)) onClose();
        })
        .catch(() => undefined);
    };
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, flush, onClose, sessionEpoch]);

  return (
    <>
      <DraftToolbar
        onBack={() => void close()}
        onDelete={() => void remove()}
        mode={viewMode}
        onToggleMode={onToggleMode}
        hideSidePeekButton
        disabled={isDeleting || status.phase === 'deleting'}
        status={
          status.phase === 'saving'
            ? '저장 중…'
            : status.phase === 'deleting'
              ? '삭제 중…'
              : status.dirty
                ? '저장되지 않은 변경사항'
                : '저장됨'
        }
        error={status.error}
        onSave={() => void flush().catch(() => undefined)}
        saveDisabled={!status.dirty || status.phase !== 'editing'}
        closeLabel="저장 후 닫기"
      />
      <div
        className={`custom-scrollbar absolute inset-x-0 top-24 bottom-0 flex flex-col items-center bg-[#11151e] px-5 pt-8 sm:px-10 sm:pt-12 lg:px-16 ${editorPhase === 'ready' ? 'overflow-y-auto' : 'overflow-hidden'}`}
        onCompositionStartCapture={() => {
          composingRef.current = true;
        }}
        onCompositionEndCapture={() => {
          composingRef.current = false;
          requestAnimationFrame(() => {
            for (const resolve of waitersRef.current.splice(0)) resolve();
          });
        }}
      >
        <div
          className={`flex w-full max-w-200 flex-col ${editorPhase === 'ready' ? '' : 'invisible'}`}
          aria-hidden={editorPhase !== 'ready'}
          inert={editorPhase !== 'ready'}
        >
          <NoteTitleInput
            autoFocus={editorPhase === 'ready'}
            onEnter={() => editorRef.current?.focus()}
            value={title}
            onChange={changeTitle}
            readOnly={status.phase === 'deleting'}
            placeholder="제목"
          />
          <div className="pb-20">
            <ErrorBoundary onError={() => onEditorPhaseChange('error')}>
              <Suspense fallback={null}>
                <NoteEditor
                  ref={editorRef}
                  documentId={`note:${ownerId}:${sessionEpoch}:${noteId}`}
                  initialMarkdown={initialMarkdown}
                  readOnly={status.phase === 'deleting'}
                  onMarkdownChange={changeContent}
                  onReady={() => onEditorPhaseChange('ready')}
                  onInitializationError={() => onEditorPhaseChange('error')}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </>
  );
}

type NotePanelContentProps = {
  note: NoteResponse | undefined;
  noteId: number;
  hasValidNoteId: boolean;
  ownerId: number | undefined;
  sessionEpoch: number;
  viewMode: 'full-screen' | 'side-peek';
  onToggleMode: () => void;
  onClose: () => void;
  closeRef: RefObject<(() => void) | null>;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

/** Keyed by note identity so a previous editor can never expose a new note. */
function NotePanelContent({
  note,
  noteId,
  hasValidNoteId,
  ownerId,
  sessionEpoch,
  viewMode,
  onToggleMode,
  onClose,
  closeRef,
  isLoading,
  isError,
  onRetry,
}: NotePanelContentProps) {
  const [editorPhase, setEditorPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const hasNote = note !== undefined && ownerId !== undefined && hasValidNoteId;
  const failed =
    !hasNote && (isError || !hasValidNoteId || (!isLoading && ownerId !== undefined && !note));

  return (
    <>
      {hasNote ? (
        <ReadyNote
          note={note}
          noteId={noteId}
          ownerId={ownerId}
          sessionEpoch={sessionEpoch}
          viewMode={viewMode}
          onToggleMode={onToggleMode}
          onClose={onClose}
          closeRef={closeRef}
          editorPhase={editorPhase}
          onEditorPhaseChange={setEditorPhase}
        />
      ) : (
        <>
          <DraftToolbar
            onBack={onClose}
            mode={viewMode}
            onToggleMode={onToggleMode}
            hideSidePeekButton
            status={isLoading ? '노트 불러오는 중…' : ''}
          />
          {failed && (
            <div className="absolute inset-x-0 top-24 bottom-0 flex flex-col items-center justify-center gap-4 px-6 text-white">
              <p role="alert">노트를 불러올 수 없습니다.</p>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg border border-white/40 px-4 py-2"
              >
                다시 시도
              </button>
            </div>
          )}
        </>
      )}
      {!failed && (!hasNote || editorPhase === 'loading') && <EditorLoadingSurface />}
      {hasNote && editorPhase === 'error' && (
        <div className="absolute inset-x-0 top-24 bottom-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p role="alert">편집기를 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-white/40 px-4 py-2"
          >
            다시 시도
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Note 페이지 with SidePeekOverlay
 * - /notes/:noteId 경로에서 사용
 * - Graph 배경 + SidePeekOverlay로 노트 표시
 * - DraftEditor와 동일한 구조 재사용
 */
export function NoteViewPage() {
  const navigate = useNavigate();
  const { noteId } = useParams({ from: '/notes/$noteId' });
  const parsedNoteId = Number(noteId);
  const hasValidNoteId = Number.isSafeInteger(parsedNoteId) && parsedNoteId > 0;
  const [viewMode, setViewMode] = useState<'full-screen' | 'side-peek'>('full-screen');
  const closeRef = useRef<(() => void) | null>(null);
  const ownerId = useAuthStore((state) => state.user?.id);
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);

  // Graph 렌더링 제어 (GPU 최적화)
  const { pauseGraph, resumeGraph } = useGraphStore();

  // 노트 데이터 가져오기
  const { data: noteData, isLoading, isError, refetch } = useNoteQuery(noteId);

  // 페이지 마운트 시 Graph 일시정지, 언마운트 시 재개
  useEffect(() => {
    pauseGraph();
    return () => {
      resumeGraph();
    };
  }, [pauseGraph, resumeGraph]);

  const handleClose = () => {
    void navigate({ to: '/main' });
  };

  const handleToggleMode = () => {
    setViewMode((prev) => (prev === 'full-screen' ? 'side-peek' : 'full-screen'));
  };

  const handleCreateDraft = () => {
    const draftId = crypto.randomUUID();
    void navigate({ to: '/main', search: { draft: draftId } });
  };

  return (
    <MainLayout onPlusClick={handleCreateDraft}>
      {viewMode === 'side-peek' && (
        <ErrorBoundary>
          <GraphPanel />
        </ErrorBoundary>
      )}

      <SidePeekOverlay
        isOpen
        onClose={() => {
          if (closeRef.current) closeRef.current();
          else handleClose();
        }}
        mode={viewMode}
        onToggleMode={handleToggleMode}
      >
        <NotePanelContent
          key={`${sessionEpoch}:${noteId}`}
          note={noteData}
          noteId={parsedNoteId}
          hasValidNoteId={hasValidNoteId}
          ownerId={ownerId}
          sessionEpoch={sessionEpoch}
          viewMode={viewMode}
          onToggleMode={handleToggleMode}
          onClose={handleClose}
          closeRef={closeRef}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
        />
      </SidePeekOverlay>
    </MainLayout>
  );
}
