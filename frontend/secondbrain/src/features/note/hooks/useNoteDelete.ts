import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteNotes, noteQueries } from '@/api/client/noteApi';
import { captureSessionEpoch, isCurrentSession } from '@/stores/authStore';
import type { NoteDeleteRequest } from '@/features/note/types/note';

/** Deletion completes after the server acknowledges it and related caches refresh. */
export function useNoteDelete() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, NoteDeleteRequest & { sessionEpoch: number }>({
    mutationFn: ({ noteIds, sessionEpoch }) => deleteNotes(noteIds, { sessionEpoch }),
    onSuccess: async (_data, variables) => {
      if (!isCurrentSession(variables.sessionEpoch)) return;
      await Promise.all([
        ...variables.noteIds.map((noteId) =>
          queryClient.invalidateQueries({ queryKey: noteQueries.detail(noteId) }),
        ),
        queryClient.invalidateQueries({ queryKey: noteQueries.all }),
        queryClient.invalidateQueries({ queryKey: ['note'] }),
        queryClient.invalidateQueries({ queryKey: ['graphs', 'visualization'] }),
      ]);
    },
  });
}

export function noteDeleteRequest(noteIds: number[]): NoteDeleteRequest & { sessionEpoch: number } {
  return { noteIds, sessionEpoch: captureSessionEpoch() };
}
