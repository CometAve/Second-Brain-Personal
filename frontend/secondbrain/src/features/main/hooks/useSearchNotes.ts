import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { searchAPI } from '@/features/main/services/searchService';
import type { SearchNoteData } from '@/features/main/types/search';
import { useAuthStore } from '@/stores/authStore';
import { useDebounce } from '@/features/main/hooks/useDebounce';

const PAGE_SIZE = 10;

interface UseSearchNotesParams<Select = InfiniteData<SearchNoteData>> {
  keyword: string;
  select?: (data: InfiniteData<SearchNoteData>) => Select;
}

export function useSearchNotes<Select = InfiniteData<SearchNoteData>>({
  keyword,
  select,
}: UseSearchNotesParams<Select>) {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const debouncedKeyword = useDebounce(keyword);
  const isDebouncing = keyword !== debouncedKeyword;
  const query = useInfiniteQuery<SearchNoteData, Error, Select, readonly unknown[], number>({
    queryKey: ['notes', 'search', keyword, sessionEpoch],
    queryFn: ({ pageParam, signal }) =>
      searchAPI.getSearchNote(
        {
          keyword,
          page: pageParam,
          size: PAGE_SIZE,
        },
        sessionEpoch,
        signal,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      // currentPage가 totalPages - 1보다 작으면 다음 페이지가 있음
      const hasNextPage = lastPage.currentPage < lastPage.totalPages - 1;
      return hasNextPage ? lastPage.currentPage + 1 : undefined;
    },
    enabled: isAuthenticated && keyword.trim().length > 0 && !isDebouncing,
    select,
  });
  return { ...query, isDebouncing };
}
