import { useState, useEffect } from 'react';
import SearchIcon from '@/shared/components/icon/Search.svg?react';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { useDebounce } from '@/features/main/hooks/useDebounce';

/**
 * 검색바 컴포넌트
 * - 검색 아이콘 + 밑줄 스타일
 * - 디바운싱을 통한 검색 쿼리 최적화
 * - 검색 결과가 있을 때만 패널 표시
 */
export function SearchBar() {
  const startSearch = useSearchPanelStore((state) => state.startSearch);
  const closePanel = useSearchPanelStore((state) => state.closePanel);

  // 로컬 상태로 검색어 관리
  const [searchInput, setSearchInput] = useState('');
  // 150ms 디바운싱 적용 (더 빠른 응답성)
  const debouncedSearchInput = useDebounce(searchInput, 150);

  // 검색어 변경 기반 패널 표시 로직
  useEffect(() => {
    const trimmedInput = debouncedSearchInput.trim();

    if (!trimmedInput) {
      // store에서 직접 현재 mode 확인 (의존성 배열에서 제거하여 race condition 방지)
      const currentMode = useSearchPanelStore.getState().mode;
      if (currentMode === 'search') {
        closePanel();
      }
      return;
    }

    // 검색어 변경 시에만 검색 패널 열기
    startSearch(debouncedSearchInput);
  }, [debouncedSearchInput, closePanel, startSearch]);

  return (
    <div className="flex items-center gap-3">
      <SearchIcon className="text-white/80" />
      <input
        type="text"
        placeholder="검색"
        aria-label="검색"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-75 border-b-2 border-white/60 bg-transparent pb-2 text-white outline-hidden transition-colors placeholder:text-white/50 focus:border-white"
      />
    </div>
  );
}
