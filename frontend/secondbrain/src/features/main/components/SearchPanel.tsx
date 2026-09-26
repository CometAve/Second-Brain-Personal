import { useEffect, useMemo } from 'react';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { PanelHeader } from '@/features/main/components/PanelHeader';
import { NoteList } from '@/features/main/components/NoteList';
import { useRecentNotes } from '@/features/main/hooks/useRecentNotes';
import { useSearchNotes } from '@/features/main/hooks/useSearchNotes';

export function SearchPanel() {
  const mode = useSearchPanelStore((state) => state.mode);
  const query = useSearchPanelStore((state) => state.query);
  const setHighlightedNodes = useSearchPanelStore((state) => state.setHighlightedNodes);
  const clearHighlightedNodes = useSearchPanelStore((state) => state.clearHighlightedNodes);
  const retainVisibleSelection = useSearchPanelStore((state) => state.retainVisibleSelection);

  // 전체 데이터 조회 (NoteList 컴포넌트용)
  const recentNotesQuery = useRecentNotes();
  const searchNotesQuery = useSearchNotes({ keyword: query });

  const searchNoteIds = useMemo(() => {
    if (searchNotesQuery.isDebouncing || !searchNotesQuery.data) return [];
    return searchNotesQuery.data.pages.flatMap((page) => page.results.map((note) => note.id));
  }, [searchNotesQuery.data, searchNotesQuery.isDebouncing]);

  // 현재 모드에 따른 모든 노트 ID 추출 (전체 선택용)
  const allNoteIds = useMemo(() => {
    if (mode === 'recent' && recentNotesQuery.data) {
      return recentNotesQuery.data.map((note) => note.noteId);
    }
    if (mode === 'search' && !searchNotesQuery.isDebouncing && searchNotesQuery.data) {
      return searchNotesQuery.data.pages.flatMap(
        (page) => page.results?.map((note) => note.id) ?? [],
      );
    }
    return [];
  }, [mode, recentNotesQuery.data, searchNotesQuery.data, searchNotesQuery.isDebouncing]);

  useEffect(() => {
    retainVisibleSelection(allNoteIds);
  }, [allNoteIds, retainVisibleSelection]);

  // 검색 모드일 때 검색 결과 노드를 그래프에서 강조
  useEffect(() => {
    if (mode === 'search' && searchNoteIds.length > 0) {
      setHighlightedNodes(searchNoteIds);
    } else {
      clearHighlightedNodes();
    }
  }, [mode, searchNoteIds, setHighlightedNodes, clearHighlightedNodes]);

  return (
    <section
      aria-label={mode === 'search' ? '노트 검색 결과' : '최근 노트'}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_12px_48px_#0005]"
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          !event.nativeEvent.isComposing &&
          !event.defaultPrevented &&
          !document.querySelector('[role="alertdialog"]')
        ) {
          event.preventDefault();
          useSearchPanelStore.getState().closePanel();
          document.getElementById('search-panel-toggle')?.focus();
        }
      }}
    >
      <PanelHeader
        allNoteIds={allNoteIds}
        hasResults={
          mode === 'recent'
            ? recentNotesQuery.data !== undefined
            : !searchNotesQuery.isDebouncing && searchNotesQuery.data !== undefined
        }
      />
      <div
        data-scroll-container="true"
        className="flex min-h-0 flex-1 scrollbar-thin [scrollbar-color:#465168_transparent] flex-col overflow-y-auto px-3 pb-3"
      >
        {mode === 'recent' && <NoteList type="recent" recentQuery={recentNotesQuery} />}
        {mode === 'search' && (
          <NoteList
            type="search"
            searchQuery={searchNotesQuery}
            isDebouncing={searchNotesQuery.isDebouncing}
          />
        )}
      </div>
    </section>
  );
}
