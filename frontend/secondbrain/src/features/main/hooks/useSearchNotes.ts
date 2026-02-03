import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { searchAPI } from '@/features/main/services/searchService';
import type { SearchNoteData } from '@/features/main/types/search';

const PAGE_SIZE = 10;

interface UseSearchNotesParams<Select = InfiniteData<SearchNoteData>> {
  keyword: string;
  select?: (data: InfiniteData<SearchNoteData>) => Select;
}

export function useSearchNotes<Select = InfiniteData<SearchNoteData>>({
  keyword,
  select,
}: UseSearchNotesParams<Select>) {
  return useInfiniteQuery<SearchNoteData, Error, Select, readonly unknown[], number>({
    queryKey: ['notes', 'search', keyword],
    queryFn: async ({ pageParam }) => {
      const response = await searchAPI.getSearchNote({
        keyword,
        page: pageParam,
        size: PAGE_SIZE,
      });
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      // currentPage가 totalPages - 1보다 작으면 다음 페이지가 있음
      const hasNextPage = lastPage.currentPage < lastPage.totalPages - 1;
      return hasNextPage ? lastPage.currentPage + 1 : undefined;
    },
    enabled: keyword.trim().length > 0,
    select,
  });
}
