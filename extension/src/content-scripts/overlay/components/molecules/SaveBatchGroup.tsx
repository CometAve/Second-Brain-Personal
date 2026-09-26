import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SaveStatusItem } from '@/content-scripts/overlay/components/molecules/SaveStatusItem';
import type { SaveRequest } from '@/types/save';

/**
 * Save Batch Group (Molecule)
 * - 한 번에 저장한 URL들을 그룹으로 표시
 * - 접힘/펼침 기능으로 공간 절약
 * - 배치 전체 진행 상황 표시
 */

interface SaveBatchGroupProps {
  batchId: string;
  requests: SaveRequest[];
  onRemove: (id: string) => void;
}

export function SaveBatchGroup({ requests, onRemove }: SaveBatchGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (requests.length === 0) return null;

  // 배치 통계
  const total = requests.length;
  const completed = requests.filter((r) => r.status === 'success').length;
  const failed = requests.filter((r) => r.status === 'error').length;

  // 배치 상태
  const batchStatus =
    failed === total ? 'failed' : completed === total ? 'completed' : 'in-progress';

  // 타임스탬프
  const timestamp = requests[0].batchTimestamp;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header - 클릭하여 펼침/접힘 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-accent"
      >
        <div className="flex flex-1 items-center gap-2">
          <ChevronDown
            className={`size-4 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
          />
          <span className="text-sm font-medium text-card-foreground">
            {total}개 페이지{' '}
            {batchStatus === 'completed'
              ? '저장 완료'
              : batchStatus === 'failed'
                ? '저장 실패'
                : '저장 중'}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(timestamp).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>

        {/* Status Badge */}
        <div className="flex shrink-0 items-center gap-2">
          {failed > 0 && (
            <span className="text-xs font-medium text-destructive">{failed}개 실패</span>
          )}
        </div>
      </button>

      {/* Items - 펼쳐졌을 때만 표시 */}
      {isExpanded && (
        <div className="space-y-2 border-t border-border p-2">
          {requests.map((request) => (
            <SaveStatusItem key={request.id} request={request} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
