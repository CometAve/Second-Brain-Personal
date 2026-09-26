import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';

export function SearchBar() {
  const query = useSearchPanelStore((state) => state.query);
  const updateQuery = useSearchPanelStore((state) => state.updateQuery);
  const openRecent = useSearchPanelStore((state) => state.openRecent);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 transition-colors focus-within:border-primary/60 focus-within:bg-white/6">
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        placeholder="노트 검색"
        aria-label="검색"
        aria-controls="search-panel"
        value={query}
        onChange={(event) => updateQuery(event.currentTarget.value)}
        onFocus={() => {
          if (!query.trim()) openRecent();
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.defaultPrevented) return;
          if (event.key === 'ArrowDown') {
            const firstResult = document.querySelector<HTMLElement>(
              '#search-panel:not([inert]) [data-note-link], #search-panel:not([inert]) input[type="checkbox"]',
            );
            if (firstResult) {
              event.preventDefault();
              firstResult.focus();
            }
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      {query && (
        <button
          type="button"
          aria-label="검색어 지우기"
          className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-white/8 hover:text-foreground"
          onClick={() => {
            updateQuery('');
            inputRef.current?.focus();
          }}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
