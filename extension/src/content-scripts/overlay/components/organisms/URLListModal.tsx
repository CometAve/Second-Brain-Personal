import { X, Trash2 } from 'lucide-react';
import { Button } from '@/content-scripts/overlay/components/ui/button';

/**
 * URL List Modal (Organism)
 * - 수집된 URL 목록 표시
 * - 개별 URL 삭제 기능
 * - 전체 삭제 기능
 * - Shadow DOM 환경 최적화
 */
interface URLListModalProps {
  isOpen: boolean;
  onClose: () => void;
  urls: string[];
  onRemove: (url: string) => void;
  onClearAll: () => void;
}

export function URLListModal({ isOpen, onClose, urls, onRemove, onClearAll }: URLListModalProps) {
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
            추가한 페이지 ({urls.length})
          </h3>
          {urls.length > 0 && (
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

      {/* URL List */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent">
        {urls.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            추가된 페이지가 없습니다
          </div>
        ) : (
          urls.map((url) => (
            <div
              key={url}
              className="group flex items-center gap-2 rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent"
            >
              <span
                className="flex-1 cursor-pointer truncate text-xs text-foreground hover:text-primary hover:underline"
                title={url}
                onClick={() => window.open(url, '_blank')}
              >
                {url}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="size-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(url);
                }}
                aria-label={`${url} 삭제`}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
