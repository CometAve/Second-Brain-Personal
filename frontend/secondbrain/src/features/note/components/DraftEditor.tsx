import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { draftQueries, getDraft } from '@/api/client/draftApi';
import { SidePeekOverlay } from '@/features/note/components/SidePeekOverlay';
import { DraftToolbar } from '@/features/note/components/DraftToolbar';
import { EditorLoadingSurface } from '@/features/note/components/EditorLoadingSurface';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary';
import { NoteTitleInput } from '@/features/note/components/NoteTitleInput';
import type { NoteEditorHandle } from '@/features/note/components/NoteEditor';
import { useNoteDraft } from '@/features/note/hooks/useNoteDraft';
import { useGraphStore } from '@/features/main/stores/graphStore';
import { isNotFoundError } from '@/shared/utils/typeGuards';
import { useAuthStore } from '@/stores/authStore';
import type { NoteDraftResponse } from '@/shared/types/draft.types';
import '@/shared/styles/custom-scrollbar.css';

const NoteEditor = lazy(() =>
  import('@/features/note/components/NoteEditor').then((module) => ({
    default: module.NoteEditor,
  })),
);

type DraftEditorProps = { draftId: string; isOpen: boolean; onClose: () => void };
type ReadyEditorProps = {
  draftId: string;
  ownerId: number;
  sessionEpoch: number;
  initialDraft: NoteDraftResponse | null;
  viewMode: 'full-screen' | 'side-peek';
  onToggleMode: () => void;
  onClose: () => void;
  closeRef: RefObject<(() => void) | null>;
  editorPhase: 'loading' | 'ready' | 'error';
  onEditorPhaseChange: (phase: 'ready' | 'error') => void;
};

export function DraftEditor(props: DraftEditorProps) {
  return <DraftEditorInternal key={props.draftId} {...props} />;
}

function DraftEditorInternal({ draftId, isOpen, onClose }: DraftEditorProps) {
  const [viewMode, setViewMode] = useState<'full-screen' | 'side-peek'>('full-screen');
  const pauseGraph = useGraphStore((state) => state.pauseGraph);
  const resumeGraph = useGraphStore((state) => state.resumeGraph);
  const ownerId = useAuthStore((state) => state.user?.id);
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const closeRef = useRef<(() => void) | null>(null);
  const draftQuery = useQuery({
    queryKey: draftQueries.detail(draftId, sessionEpoch),
    queryFn: ({ signal }) => getDraft(draftId, { sessionEpoch, signal }),
    retry: false,
    staleTime: Infinity,
    enabled: ownerId !== undefined,
  });
  useEffect(() => {
    if (!isOpen) return;
    pauseGraph();
    return () => resumeGraph();
  }, [isOpen, pauseGraph, resumeGraph]);

  const toggleMode = () =>
    setViewMode((previous) => (previous === 'full-screen' ? 'side-peek' : 'full-screen'));
  const ready =
    ownerId !== undefined &&
    (draftQuery.isSuccess || (draftQuery.isError && isNotFoundError(draftQuery.error)));
  const requestClose = () => {
    if (closeRef.current) closeRef.current();
    else onClose();
  };

  return (
    <SidePeekOverlay
      isOpen={isOpen}
      onClose={requestClose}
      mode={viewMode}
      onToggleMode={toggleMode}
    >
      <DraftPanelContent
        key={`${sessionEpoch}:${draftId}`}
        draftId={draftId}
        ownerId={ownerId}
        sessionEpoch={sessionEpoch}
        initialDraft={draftQuery.isSuccess ? draftQuery.data : null}
        ready={ready}
        isPending={draftQuery.isPending}
        viewMode={viewMode}
        onToggleMode={toggleMode}
        onClose={onClose}
        closeRef={closeRef}
        onRetry={() => void draftQuery.refetch()}
      />
    </SidePeekOverlay>
  );
}

type DraftPanelContentProps = Omit<
  ReadyEditorProps,
  'ownerId' | 'editorPhase' | 'onEditorPhaseChange'
> & {
  ownerId: number | undefined;
  ready: boolean;
  isPending: boolean;
  onRetry: () => void;
};

/** Holds one loading surface across draft fetch, chunk load and editor setup. */
function DraftPanelContent({
  draftId,
  ownerId,
  sessionEpoch,
  initialDraft,
  ready,
  isPending,
  viewMode,
  onToggleMode,
  onClose,
  closeRef,
  onRetry,
}: DraftPanelContentProps) {
  const [editorPhase, setEditorPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const failed = !ready && !isPending && ownerId !== undefined;

  return (
    <>
      {ready && ownerId !== undefined ? (
        <ReadyDraftEditor
          draftId={draftId}
          ownerId={ownerId}
          sessionEpoch={sessionEpoch}
          initialDraft={initialDraft}
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
            status={isPending ? '초안 불러오는 중…' : ''}
          />
          {failed && (
            <div className="absolute inset-x-0 top-24 bottom-0 flex flex-col items-center justify-center gap-4 px-6 text-white">
              <p role="alert">초안을 불러오지 못했습니다. 다시 시도해 주세요.</p>
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
      {!failed && (!ready || editorPhase === 'loading') && <EditorLoadingSurface />}
      {ready && editorPhase === 'error' && (
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

function ReadyDraftEditor({
  draftId,
  ownerId,
  sessionEpoch,
  initialDraft,
  viewMode,
  onToggleMode,
  onClose,
  closeRef,
  editorPhase,
  onEditorPhaseChange,
}: ReadyEditorProps) {
  const composingRef = useRef(false);
  const compositionWaitersRef = useRef<Array<() => void>>([]);
  const editorRef = useRef<NoteEditorHandle | null>(null);
  const {
    title,
    initialMarkdown,
    status,
    handleTitleChange,
    handleContentChange,
    requestClose,
    requestDiscard,
  } = useNoteDraft({
    draftId,
    ownerId,
    sessionEpoch,
    initialDraft,
    onClose,
    beforeClose: waitForComposition,
    isComposing: () => composingRef.current,
  });
  const editorLocked = status.phase === 'promoting' || status.phase === 'deleting';

  async function waitForComposition() {
    if (composingRef.current)
      await new Promise<void>((resolve) => compositionWaitersRef.current.push(resolve));
  }
  async function handleClose() {
    await waitForComposition();
    try {
      await requestClose();
    } catch {
      /* The coordinator keeps input and reports the failure. */
    }
  }
  async function handleDelete() {
    await waitForComposition();
    try {
      await requestDiscard();
    } catch {
      /* Deletion failure keeps the editor open. */
    }
  }
  useEffect(() => {
    closeRef.current = () => {
      void (async () => {
        if (composingRef.current)
          await new Promise<void>((resolve) => compositionWaitersRef.current.push(resolve));
        try {
          await requestClose();
        } catch {
          /* Keep failed saves visible. */
        }
      })();
    };
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, requestClose]);

  const message =
    status.phase === 'promoting'
      ? '노트 저장 중…'
      : status.phase === 'deleting'
        ? '초안 삭제 중…'
        : status.phase === 'saving'
          ? '임시 저장 중…'
          : '작성 중';
  return (
    <>
      <DraftToolbar
        onBack={() => void handleClose()}
        onDelete={() => void handleDelete()}
        mode={viewMode}
        onToggleMode={onToggleMode}
        disabled={editorLocked}
        status={message}
        error={status.error}
        closeLabel="작성 마치기"
        deleteLabel="초안 삭제"
      />
      <div
        className={`custom-scrollbar absolute inset-x-0 top-24 bottom-0 flex flex-col items-center bg-[#11151e] px-5 pt-8 sm:px-10 sm:pt-12 lg:px-16 ${editorPhase === 'ready' ? 'overflow-y-auto' : 'overflow-hidden'}`}
        onCompositionStartCapture={() => {
          composingRef.current = true;
        }}
        onCompositionEndCapture={() => {
          composingRef.current = false;
          requestAnimationFrame(() => {
            for (const resolve of compositionWaitersRef.current.splice(0)) resolve();
          });
        }}
      >
        <div
          className={`flex w-full max-w-200 flex-col ${editorPhase === 'ready' ? '' : 'invisible'}`}
          aria-hidden={editorPhase !== 'ready'}
          inert={editorPhase !== 'ready'}
        >
          <NoteTitleInput
            value={title}
            onChange={handleTitleChange}
            readOnly={editorLocked}
            autoFocus={editorPhase === 'ready'}
            onEnter={() => editorRef.current?.focus()}
          />
          <div className="pb-20">
            <ErrorBoundary onError={() => onEditorPhaseChange('error')}>
              <Suspense fallback={null}>
                <NoteEditor
                  ref={editorRef}
                  documentId={`draft:${draftId}`}
                  initialMarkdown={initialMarkdown}
                  readOnly={editorLocked}
                  onMarkdownChange={handleContentChange}
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
