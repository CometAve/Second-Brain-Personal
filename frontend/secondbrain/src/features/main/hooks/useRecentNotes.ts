import { useQuery } from '@tanstack/react-query';
import { searchAPI } from '@/features/main/services/searchService';
import type { RecentNote } from '@/features/main/types/search';
import { useAuthStore } from '@/stores/authStore';

interface UseRecentNotesOptions<Select = RecentNote[]> {
  select?: (data: RecentNote[]) => Select;
}

export function useRecentNotes<Select = RecentNote[]>(options?: UseRecentNotesOptions<Select>) {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<RecentNote[], Error, Select>({
    queryKey: ['notes', 'recent', sessionEpoch],
    queryFn: ({ signal }) => searchAPI.getRecentNote(sessionEpoch, signal),
    enabled: isAuthenticated,
    ...options,
  });
}
