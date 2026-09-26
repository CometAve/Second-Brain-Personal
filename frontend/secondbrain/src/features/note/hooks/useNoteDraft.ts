import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { draftQueries } from '@/api/client/draftApi';
import { noteQueries } from '@/api/client/noteApi';
import { DraftSaveCoordinator } from '@/features/note/services/draftSaveCoordinator';
import type { DraftCoordinatorStatus } from '@/features/note/services/draftSaveCoordinator';
import type { NoteDraftResponse } from '@/shared/types/draft.types';
import { isCurrentSession } from '@/stores/authStore';

type UseNoteDraftOptions = {
  draftId: string;
  ownerId: number;
  sessionEpoch: number;
  initialDraft: NoteDraftResponse | null;
  onClose: () => void;
  beforeClose?: () => Promise<void>;
  isComposing?: () => boolean;
};

/** Owns one hydrated editor's local snapshot and ordered save/delete commands. */
export function useNoteDraft({
  draftId,
  ownerId,
  sessionEpoch,
  initialDraft,
  onClose,
  beforeClose,
  isComposing,
}: UseNoteDraftOptions) {
  const queryClient = useQueryClient();
  const [coordinator] = useState(
    () => new DraftSaveCoordinator(draftId, ownerId, sessionEpoch, initialDraft),
  );
  const [snapshot, setSnapshot] = useState(coordinator.snapshot);
  const [status, setStatus] = useState<DraftCoordinatorStatus>(coordinator.currentStatus);
  const closeRef = useRef(onClose);
  const beforeCloseRef = useRef(beforeClose);
  const isComposingRef = useRef(isComposing);
  const mountedRef = useRef(false);
  const operationRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    closeRef.current = onClose;
    beforeCloseRef.current = beforeClose;
    isComposingRef.current = isComposing;
  }, [beforeClose, isComposing, onClose]);

  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      const nextDraft = 'draft' in next.search ? next.search.draft : undefined;
      if (current.pathname === next.pathname && nextDraft === draftId) return false;
      if (!isCurrentSession(sessionEpoch)) return false;
      // The last IME change may not have reached the coordinator yet.
      await beforeCloseRef.current?.();
      if (!isCurrentSession(sessionEpoch)) return false;
      const safeToLeave = await coordinator.ensureSafeToLeave();
      return isCurrentSession(sessionEpoch) && !safeToLeave;
    },
    enableBeforeUnload: () => coordinator.hasUnsafeChanges || Boolean(isComposingRef.current?.()),
  });

  const requestClose = useCallback((): Promise<void> => {
    if (operationRef.current !== null) return operationRef.current;
    const operation = (async () => {
      await beforeCloseRef.current?.();
      const result = await coordinator.close();
      if (!isCurrentSession(sessionEpoch)) return;
      if (result.kind === 'promoted') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: noteQueries.all }),
          queryClient.invalidateQueries({ queryKey: ['graphs', 'visualization'] }),
          queryClient.invalidateQueries({ queryKey: draftQueries.lists() }),
        ]);
      } else if (result.kind === 'draft') {
        await queryClient.invalidateQueries({ queryKey: draftQueries.lists() });
      }
      if (mountedRef.current && isCurrentSession(sessionEpoch)) closeRef.current();
    })().finally(() => {
      operationRef.current = null;
    });
    operationRef.current = operation;
    return operation;
  }, [coordinator, queryClient, sessionEpoch]);

  const requestDiscard = useCallback((): Promise<void> => {
    if (operationRef.current !== null) return operationRef.current;
    const operation = (async () => {
      await coordinator.discard();
      if (!isCurrentSession(sessionEpoch)) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: draftQueries.lists() }),
        queryClient.invalidateQueries({ queryKey: noteQueries.all }),
        queryClient.invalidateQueries({ queryKey: ['graphs', 'visualization'] }),
      ]);
      if (mountedRef.current && isCurrentSession(sessionEpoch)) closeRef.current();
    })().finally(() => {
      operationRef.current = null;
    });
    operationRef.current = operation;
    return operation;
  }, [coordinator, queryClient, sessionEpoch]);

  useEffect(() => {
    mountedRef.current = true;
    coordinator.attach(setStatus, () => {
      void requestClose().catch(() => undefined);
    });
    return () => {
      mountedRef.current = false;
      coordinator.detach();
      queueMicrotask(() => {
        if (!mountedRef.current) {
          queryClient.removeQueries({
            queryKey: draftQueries.detail(draftId, sessionEpoch),
            exact: true,
          });
        }
      });
    };
  }, [coordinator, draftId, queryClient, requestClose, sessionEpoch]);

  function handleTitleChange(title: string) {
    setSnapshot(coordinator.editTitle(title));
  }

  function handleContentChange(content: string) {
    setSnapshot(coordinator.editContent(content));
  }

  return {
    title: snapshot.title,
    content: snapshot.content,
    initialMarkdown: coordinator.initialMarkdown,
    version: coordinator.currentVersion,
    status,
    handleTitleChange,
    handleContentChange,
    requestClose,
    requestDiscard,
  };
}
