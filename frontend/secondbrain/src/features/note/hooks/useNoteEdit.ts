import { useEffect, useState } from 'react';
import { useBlocker } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { noteQueries } from '@/api/client/noteApi';
import { NoteEditCoordinator } from '@/features/note/services/noteEditCoordinator';
import type { NoteResponse } from '@/shared/types/note.types';
import type { NoteEditStatus } from '@/features/note/services/noteEditCoordinator';
import { isCurrentSession } from '@/stores/authStore';

type Options = {
  noteId: number;
  ownerId: number;
  sessionEpoch: number;
  initialNote: NoteResponse;
  beforeFlush: () => Promise<void>;
};

/** Local editor state stays separate from query refetches until all edits are acknowledged. */
export function useNoteEdit({ noteId, ownerId, sessionEpoch, initialNote, beforeFlush }: Options) {
  const queryClient = useQueryClient();
  const [coordinator] = useState(
    () => new NoteEditCoordinator(noteId, ownerId, sessionEpoch, initialNote),
  );
  const [snapshot, setSnapshot] = useState(coordinator.snapshot);
  const [status, setStatus] = useState<NoteEditStatus>(coordinator.currentStatus);

  useEffect(() => {
    coordinator.attach(setStatus, () => {
      if (!isCurrentSession(sessionEpoch)) return;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: noteQueries.all }),
        queryClient.invalidateQueries({ queryKey: ['note'] }),
        queryClient.invalidateQueries({ queryKey: ['graphs', 'visualization'] }),
      ]);
    });
    return () => coordinator.detach();
  }, [coordinator, queryClient, sessionEpoch]);

  async function flush(): Promise<void> {
    await beforeFlush();
    await coordinator.flush();
    if (!isCurrentSession(sessionEpoch)) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: noteQueries.all }),
      queryClient.invalidateQueries({ queryKey: ['note'] }),
      queryClient.invalidateQueries({ queryKey: ['graphs', 'visualization'] }),
    ]);
  }

  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (current.pathname === next.pathname || !isCurrentSession(sessionEpoch)) return false;
      try {
        // Composition can still hold the final input before the coordinator sees an edit.
        await beforeFlush();
        if (!isCurrentSession(sessionEpoch) || !coordinator.isDirty) return false;
        await flush();
        return false;
      } catch {
        return isCurrentSession(sessionEpoch);
      }
    },
    enableBeforeUnload: () => coordinator.isDirty,
  });

  function changeTitle(title: string) {
    setSnapshot(coordinator.editTitle(title));
  }

  function changeContent(content: string) {
    setSnapshot(coordinator.editContent(content));
  }

  return {
    title: snapshot.title,
    initialMarkdown: coordinator.initialMarkdown,
    status,
    changeTitle,
    changeContent,
    flush,
    coordinator,
  };
}
