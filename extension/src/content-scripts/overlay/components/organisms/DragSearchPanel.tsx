import { env } from '@/config/env';
import { Search, ExternalLink, Loader2, History, Trash2 } from 'lucide-react';
import type { NoteSearchResult } from '@/types/note';
import { useDragSearchStore } from '@/stores/dragSearchStore';
import browser from 'webextension-polyfill';

interface DragSearchPanelProps {
  keyword: string;
  results: NoteSearchResult[];
  totalCount: number;
  isLoading: boolean;
  error?: string | null;
  mode?: 'compact' | 'full';
  onViewAll?: () => void;
}

/**
 * 드래그 검색 결과 패널
 * - full 모드: Overlay UI 내부에 표시 (히스토리, 상세 정보)
 * - compact 모드: Floating Popup에 표시 (간소화)
 */
export function DragSearchPanel({
  keyword,
  results,
  isLoading,
  error,
  mode = 'full',
}: DragSearchPanelProps) {
  const { searchHistory, clearHistory, setLoading } = useDragSearchStore();
  const isCompact = mode === 'compact';

  // 히스토리 아이템 클릭 시 재검색
  const handleHistoryClick = (historyKeyword: string) => {
    setLoading(true);

    // Background로 검색 요청
    browser.runtime
      .sendMessage({
        type: 'SEARCH_DRAG_TEXT',
        keyword: historyKeyword,
        timestamp: Date.now(),
      })
      .catch((err) => {
        console.error('[DragSearchPanel] Failed to search from history:', err);
      });
  };
  // 로딩 상태
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center ${isCompact ? 'py-8' : 'py-12'}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className={`animate-spin text-blue-600 ${isCompact ? 'size-6' : 'size-8'}`} />
          <p className={`text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>검색 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center text-center ${isCompact ? 'py-8' : 'py-12'}`}
      >
        <div className={`mb-3 rounded-full bg-red-50 dark:bg-red-950 ${isCompact ? 'p-2' : 'p-3'}`}>
          <Search className={`text-red-500 ${isCompact ? 'size-6' : 'size-8'}`} />
        </div>
        <p className={`font-medium text-foreground ${isCompact ? 'text-sm' : 'text-base'}`}>
          검색 중 오류가 발생했습니다
        </p>
        <p className={`mt-1 text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>{error}</p>
      </div>
    );
  }

  // 결과 없음 (히스토리 표시 - full 모드만)
  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {/* 검색 결과 없음 메시지 */}
        <div
          className={`flex flex-col items-center justify-center text-center ${isCompact ? 'py-6' : 'py-8'}`}
        >
          <div className={`mb-3 rounded-full bg-muted ${isCompact ? 'p-2' : 'p-3'}`}>
            <Search className={`text-muted-foreground ${isCompact ? 'size-8' : 'size-12'}`} />
          </div>
          <p className={`font-medium text-foreground ${isCompact ? 'text-sm' : 'text-base'}`}>
            &quot;{keyword}&quot;와 관련된 노트가 없습니다
          </p>
          <p className={`mt-1 text-muted-foreground ${isCompact ? 'text-xs' : 'text-sm'}`}>
            다른 키워드로 검색해보세요
          </p>
        </div>

        {/* 검색 히스토리 (full 모드만) */}
        {!isCompact && searchHistory.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <History className="size-4" />
                최근 검색
              </h4>
              <button
                onClick={clearHistory}
                className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-red-600"
                title="히스토리 삭제"
              >
                <Trash2 className="size-3" />
                전체 삭제
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {searchHistory.map((item) => (
                <button
                  key={`${item.keyword}-${item.timestamp}`}
                  onClick={() => handleHistoryClick(item.keyword)}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <span className="truncate text-gray-700">{item.keyword}</span>
                  <span className="ml-2 shrink-0 text-xs text-gray-400">
                    {item.resultCount}개 결과
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 검색 결과 표시
  return (
    <div className="flex flex-col gap-2">
      {/* 결과 리스트 */}
      <div className="flex flex-col gap-2">
        {results.map((note) => (
          <div
            key={note.id}
            className="group cursor-pointer rounded-lg border border-border/50 bg-background p-2 transition-all hover:border-primary hover:shadow-md"
            onClick={() => {
              // Chrome Side Panel 열기
              void (async () => {
                try {
                  // Content Script에서는 browser.windows API 사용 불가
                  const response = await browser.runtime.sendMessage({
                    type: 'OPEN_SIDE_PANEL',
                    noteId: note.id,
                  });

                  // 타입 가드로 응답 확인
                  const isSuccess =
                    response &&
                    typeof response === 'object' &&
                    'success' in response &&
                    response.success === true;

                  if (!isSuccess) {
                    const errorMsg =
                      response && typeof response === 'object' && 'error' in response
                        ? response.error
                        : 'Unknown error';
                    console.warn('[DragSearchPanel] Side panel failed:', errorMsg);
                    window.open(`${env.webUrl}/notes/${note.id}`, '_blank');
                  }
                } catch (error) {
                  console.error('[DragSearchPanel] Failed to open side panel:', error);
                  // Fallback: 웹 앱에서 열기
                  window.open(`${env.webUrl}/notes/${note.id}`, '_blank');
                }
              })();
            }}
          >
            {/* 제목 */}
            <h4 className="flex items-center gap-2 text-sm font-semibold text-black transition-colors group-hover:text-primary dark:text-white">
              {note.title}
              <ExternalLink className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </h4>

            {/* 내용 미리보기 */}
            <p className="mt-1 line-clamp-1 text-xs leading-relaxed text-black/70 dark:text-white/70">
              {note.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
