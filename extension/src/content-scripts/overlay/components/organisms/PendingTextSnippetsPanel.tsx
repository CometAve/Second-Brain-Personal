import { X, Trash2, FileText } from 'lucide-react';
import { Button } from '@/content-scripts/overlay/components/ui/button';
import type { PendingTextSnippet } from '@/types/pendingTextSnippet';

/**
 * Pending Text Snippets Panel (Organism)
 * - 임시 저장된 텍스트 조각 목록 표시
 * - 개별 텍스트 삭제 기능
 * - 전체 삭제 기능
 * - URLListModal과 동일한 디자인 패턴
 * - Shadow DOM 환경 최적화
 * - 다크모드 지원
 */
interface PendingTextSnippetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: PendingTextSnippet[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

export function PendingTextSnippetsPanel({
  isOpen,
  onClose,
  snippets,
  onRemove,
  onClearAll,
}: PendingTextSnippetsPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className="w-80 rounded-lg border border-border bg-card shadow-xl"
      style={{
        maxHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="border-b border-border">
        {/* 닫기 버튼 - 우측 상단 고정 */}
        <div className="flex justify-end p-2">
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={onClose}
            aria-label="닫기"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* 정보 + 액션 - 별도 행 */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-sm font-semibold text-card-foreground">
            임시 노트 ({snippets.length})
          </h3>
          {snippets.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onClearAll}
            >
              <Trash2 className="size-3" />
              <span>전체 삭제</span>
            </Button>
          )}
        </div>
      </div>

      {/* Text Snippets List */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent">
        {snippets.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            추가된 텍스트가 없습니다
          </div>
        ) : (
          snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="group rounded-md border border-border bg-background p-3 transition-colors hover:bg-accent"
            >
              {/* 텍스트 미리보기 */}
              <div className="mb-2 flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-foreground">
                  {snippet.text}
                </p>
              </div>

              {/* 출처 정보 */}
              <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate" title={snippet.sourceUrl}>
                  {snippet.pageTitle || new URL(snippet.sourceUrl).hostname}
                </span>
              </div>

              {/* 하단: 시간 + 삭제 버튼 */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(snippet.timestamp).toLocaleString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(snippet.id);
                  }}
                  aria-label="삭제"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
