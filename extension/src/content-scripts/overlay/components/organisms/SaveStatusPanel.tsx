import { useEffect, useRef } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/content-scripts/overlay/components/ui/button';
import { SaveBatchGroup } from '@/content-scripts/overlay/components/molecules/SaveBatchGroup';
import { SaveStatusItem } from '@/content-scripts/overlay/components/molecules/SaveStatusItem';
import { useSaveStatusStore } from '@/stores/saveStatusStore';
import type { SaveRequest } from '@/types/save';

interface SaveStatusPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BatchGroup {
  batchId: string;
  requests: SaveRequest[];
  timestamp: number;
}

/**
 * 저장 상태 패널 (Organism)
 * - 현재 진행 중인 저장 요청 목록 표시
 * - 배치별로 그룹화하여 표시
 * - 실시간 상태 업데이트
 * - 완료된 항목 자동 제거
 * - Shadow DOM 환경 최적화
 */
export function SaveStatusPanel({ isOpen, onClose }: SaveStatusPanelProps) {
  const { getRequestList, removeSaveRequest } = useSaveStatusStore();
  const requests = getRequestList();

  // 모두 지우기 핸들러
  function handleClearAll() {
    // 모든 요청 삭제
    requests.forEach((req) => removeSaveRequest(req.id));
  }
  const hadRequestsRef = useRef(false);

  // 모든 항목이 처리되면 자동으로 패널 닫기
  useEffect(() => {
    // 요청이 있었다가 모두 사라진 경우에만 닫기
    if (hadRequestsRef.current && requests.length === 0 && isOpen) {
      // 마지막 항목의 페이드아웃 애니메이션(500ms)이 끝난 후 닫기
      const timer = setTimeout(() => {
        onClose();
      }, 600);

      return () => clearTimeout(timer);
    }

    // 요청이 있으면 플래그 설정
    if (requests.length > 0) {
      hadRequestsRef.current = true;
    } else {
      hadRequestsRef.current = false;
    }
  }, [requests.length, isOpen, onClose]);

  // batchId로 그룹화
  function groupByBatchId(requests: SaveRequest[]): BatchGroup[] {
    const groups = new Map<string, SaveRequest[]>();

    requests.forEach((req) => {
      const existing = groups.get(req.batchId) || [];
      groups.set(req.batchId, [...existing, req]);
    });

    return Array.from(groups.entries())
      .map(([batchId, reqs]) => ({
        batchId,
        requests: reqs,
        timestamp: reqs[0]?.batchTimestamp || Date.now(),
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // 최신순
  }

  const batches = groupByBatchId(requests);

  return (
    <div
      className="w-80 rounded-lg border border-border bg-card shadow-xl"
      style={{
        maxHeight: '300px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="border-b border-border">
        {/* 닫기 버튼 - 우측 상단 */}
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

        {/* 제목 + 모두 지우기 */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h3 className="text-sm font-semibold text-card-foreground">저장 진행 상황</h3>
          {requests.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
              onClick={handleClearAll}
            >
              <Trash2 className="size-3" />
              <span>모두 지우기</span>
            </Button>
          )}
        </div>
      </div>

      {/* Batch Groups / Single Items */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent">
        {batches.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            저장 중인 항목이 없습니다
          </div>
        ) : (
          batches.map((batch) =>
            batch.requests.length === 1 ? (
              // 단일 페이지: 낱개 표시
              <SaveStatusItem
                key={batch.requests[0].id}
                request={batch.requests[0]}
                onRemove={removeSaveRequest}
              />
            ) : (
              // 다중 페이지: 그룹 표시
              <SaveBatchGroup
                key={batch.batchId}
                batchId={batch.batchId}
                requests={batch.requests}
                onRemove={removeSaveRequest}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}
