import type { UseQueryResult, UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import type { RecentNote, SearchNoteData, Note } from '@/features/main/types/search';
import { NoteItem } from '@/features/main/components/NoteItem';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useInfiniteScroll } from '@/shared/hooks/useInfiniteScroll';

interface NoteListProps {
  type: 'recent' | 'search';
  recentQuery?: UseQueryResult<RecentNote[], Error>;
  searchQuery?: UseInfiniteQueryResult<InfiniteData<SearchNoteData>, Error>;
  isDebouncing?: boolean;
}

export function NoteList({ type, recentQuery, searchQuery, isDebouncing = false }: NoteListProps) {
  const selectedIds = useSearchPanelStore((state) => state.selectedIds);
  const toggleSelection = useSearchPanelStore((state) => state.toggleSelection);
  const isDeleteMode = useSearchPanelStore((state) => state.isDeleteMode);

  // 무한 스크롤: TanStack Query useInfiniteQuery와 통합
  const { observerRef } = useInfiniteScroll({
    enabled: type === 'search' && !isDebouncing && !searchQuery?.isFetchNextPageError,
    hasNextPage: searchQuery?.hasNextPage ?? false,
    isFetchingNextPage: searchQuery?.isFetchingNextPage ?? false,
    fetchNextPage: searchQuery?.fetchNextPage ?? (() => {}),
  });

  if (type === 'recent' && recentQuery) {
    if (recentQuery.isLoading) {
      return (
        <LoadingSpinner
          size="sm"
          fullScreen={false}
          className="flex-1"
          message="노트를 불러오는 중"
        />
      );
    }

    if (recentQuery.isError && !recentQuery.data) {
      return (
        <div
          className="flex flex-col items-center gap-3 px-3 py-8 text-center text-sm text-destructive"
          role="alert"
        >
          <p>최근 노트를 불러오지 못했습니다.</p>
          <button type="button" onClick={() => void recentQuery.refetch()}>
            다시 시도
          </button>
        </div>
      );
    }

    if (!recentQuery.data) {
      return (
        <p className="px-4 py-10 text-center text-sm leading-6 text-muted-foreground">
          최근 노트가 없습니다.
        </p>
      );
    }

    // recentQuery.data는 이미 RecentNote[] 배열
    const noteData = recentQuery.data;

    if (!Array.isArray(noteData) || noteData.length === 0) {
      return recentQuery.isError ? (
        <p className="m-0 text-center text-sm text-red-300" role="alert">
          최근 노트 갱신에 실패했습니다.{' '}
          <button type="button" onClick={() => void recentQuery.refetch()}>
            다시 시도
          </button>
        </p>
      ) : (
        <p className="px-4 py-10 text-center text-sm leading-6 text-muted-foreground">
          최근 노트가 없습니다.
        </p>
      );
    }

    return (
      <div className="w-full">
        {recentQuery.isError && (
          <p className="pb-3 text-center text-sm text-red-300" role="alert">
            최근 노트 갱신에 실패했습니다.{' '}
            <button type="button" onClick={() => void recentQuery.refetch()}>
              다시 시도
            </button>
          </p>
        )}
        {noteData.map((note, index) => (
          <div key={note.noteId}>
            <NoteItem
              note={note}
              isSelected={selectedIds.has(note.noteId)}
              onToggle={toggleSelection}
              isDeleteMode={isDeleteMode}
            />
            {index < noteData.length - 1 && <div className="mx-3 border-b border-white/5" />}
          </div>
        ))}
      </div>
    );
  }

  if (type === 'search' && searchQuery) {
    if (isDebouncing) {
      return (
        <LoadingSpinner
          size="sm"
          fullScreen={false}
          className="flex-1"
          message="노트를 불러오는 중"
        />
      );
    }

    // 로딩 중
    if (searchQuery.isLoading) {
      return (
        <LoadingSpinner
          size="sm"
          fullScreen={false}
          className="flex-1"
          message="노트를 불러오는 중"
        />
      );
    }

    // 에러 발생
    if (searchQuery.isError && !searchQuery.data) {
      return (
        <div
          className="flex flex-col items-center gap-3 px-3 py-8 text-center text-sm text-destructive"
          role="alert"
        >
          <p>검색 결과를 불러오지 못했습니다.</p>
          <button type="button" onClick={() => void searchQuery.refetch()}>
            다시 시도
          </button>
        </div>
      );
    }

    // 데이터 없음 (아직 로딩 전)
    if (!searchQuery.data) {
      return null;
    }

    const allNotes = searchQuery.data.pages.flatMap((page) => {
      return page.results || [];
    });

    // 검색 결과 없음
    if (allNotes.length === 0) {
      return searchQuery.isError ? (
        <p className="m-0 py-8 text-center text-sm text-red-300" role="alert">
          검색 결과 갱신에 실패했습니다.{' '}
          <button type="button" onClick={() => void searchQuery.refetch()}>
            다시 시도
          </button>
        </p>
      ) : (
        <p className="px-4 py-10 text-center text-sm leading-6 text-muted-foreground">
          검색 결과가 없습니다.
        </p>
      );
    }

    return (
      <>
        {searchQuery.isError && (
          <p className="pb-3 text-center text-sm text-red-300" role="alert">
            {searchQuery.isFetchNextPageError
              ? '추가 결과를 불러오지 못했습니다.'
              : '검색 결과 갱신에 실패했습니다.'}{' '}
            <button
              type="button"
              onClick={() =>
                void (searchQuery.isFetchNextPageError
                  ? searchQuery.fetchNextPage()
                  : searchQuery.refetch())
              }
            >
              다시 시도
            </button>
          </p>
        )}
        <div className="w-full">
          {allNotes.map((note: Note, index: number) => (
            <div key={note.id}>
              <NoteItem
                note={note}
                isSelected={selectedIds.has(note.id)}
                onToggle={toggleSelection}
                isDeleteMode={isDeleteMode}
              />
              {index < allNotes.length - 1 && <div className="mx-3 border-b border-white/5" />}
              {/* 마지막 아이템 또는 마지막에서 3번째 중 작은 인덱스에 배치 */}
              {index === Math.min(allNotes.length - 1, Math.max(0, allNotes.length - 3)) && (
                <div ref={observerRef} className="h-1" />
              )}
            </div>
          ))}
        </div>

        {/* 다음 페이지 로딩 중 표시 */}
        {searchQuery.isFetchingNextPage && (
          <p className="m-0 py-4 text-center text-sm text-muted-foreground">더 불러오는 중</p>
        )}
      </>
    );
  }

  return null;
}
