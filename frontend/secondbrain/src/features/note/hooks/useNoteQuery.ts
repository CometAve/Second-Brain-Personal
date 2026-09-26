import { useQuery } from '@tanstack/react-query';
import { getNote, noteQueries } from '@/api/client/noteApi';
import { useAuthStore } from '@/stores/authStore';

/** Loads one note through the validated, session-bound API adapter. */
export function useNoteQuery(noteId: string) {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const id = Number(noteId);
  return useQuery({
    queryKey: [...noteQueries.detail(id), sessionEpoch],
    queryFn: ({ signal }) => getNote(id, { sessionEpoch, signal }),
    enabled: Number.isSafeInteger(id) && id > 0,
    retry: false,
  });
}
