import { Search, X } from 'lucide-react';
import { useRef, useEffect } from 'react';

/**
 * SearchInput (Atom)
 * - 검색 입력창
 * - Focus/Blur 이벤트 처리
 * - Enter: 검색, ESC: 취소
 * - 다크모드 지원
 */
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSearch: () => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchInput({
  value,
  onChange,
  onFocus,
  onBlur,
  onSearch,
  onCancel,
  placeholder = '노트 검색...',
  autoFocus = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // 키보드 이벤트
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative w-full">
      <div className="flex items-center gap-2">
        {/* 검색 입력창 */}
        <div className="relative flex-1">
          {/* 검색 아이콘 (항상 표시) */}
          <div className="absolute top-2.5 left-3 flex items-center">
            <Search className="size-4 text-muted-foreground" />
          </div>

          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-9 w-full rounded-lg border border-border bg-background py-2 pr-3 pl-10 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>

        {/* 취소 버튼 */}
        <button
          onClick={onCancel}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-accent"
          title="검색 취소 (ESC)"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
