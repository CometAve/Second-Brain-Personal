import { X } from 'lucide-react';
import type { FloatingButtonPosition } from '@/types/dragSearch';
import type { NoteSearchResult } from '@/types/note';
import { DragSearchPanel } from '@/content-scripts/overlay/components/organisms/DragSearchPanel';
import { ThemeProvider } from '@/contexts/ThemeProvider';

interface CompactSearchPopupProps {
  position: FloatingButtonPosition;
  keyword: string;
  results: NoteSearchResult[];
  totalCount: number;
  isLoading: boolean;
  error?: string | null;
  onViewAll: () => void;
  onClose: () => void;
}

/**
 * Compact Search Popup
 * - 드래그 위치 근처에 표시되는 간소화된 검색 결과 팝업
 * - Shadow DOM 내부에서 렌더링
 * - ThemeProvider로 다크모드 지원
 */
export function CompactSearchPopup({
  keyword,
  results,
  totalCount,
  isLoading,
  error,
  onViewAll,
  onClose,
}: CompactSearchPopupProps) {
  return (
    <ThemeProvider>
      <div
        className="w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        style={{
          maxHeight: 'min(500px, 80vh)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 닫기 버튼 */}
        <div className="flex justify-end px-3 py-2">
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground transition-all hover:rotate-90 hover:bg-accent hover:text-foreground"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 검색 결과 */}
        <div className="scrollbar-custom flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          <DragSearchPanel
            keyword={keyword}
            results={results}
            totalCount={totalCount}
            isLoading={isLoading}
            error={error}
            mode="compact"
            onViewAll={onViewAll}
          />
        </div>
      </div>
    </ThemeProvider>
  );
}
