import { useState } from 'react';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { Check, ListChecks, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { noteDeleteRequest, useNoteDelete } from '@/features/note/hooks/useNoteDelete';
import { isCurrentSession, useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

interface PanelHeaderProps {
  allNoteIds: number[];
  hasResults: boolean;
}

export function PanelHeader({ allNoteIds, hasResults }: PanelHeaderProps) {
  const mode = useSearchPanelStore((state) => state.mode);
  const query = useSearchPanelStore((state) => state.query);
  const closePanel = useSearchPanelStore((state) => state.closePanel);
  const isDeleteMode = useSearchPanelStore((state) => state.isDeleteMode);
  const toggleDeleteMode = useSearchPanelStore((state) => state.toggleDeleteMode);
  const exitDeleteMode = useSearchPanelStore((state) => state.exitDeleteMode);
  const selectedIds = useSearchPanelStore((state) => state.selectedIds);
  const selectAll = useSearchPanelStore((state) => state.selectAll);
  const deselectAll = useSearchPanelStore((state) => state.deselectAll);
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);

  const { mutate: deleteNotes, isPending: isDeleting } = useNoteDelete();
  const [frozenDelete, setFrozenDelete] = useState<{ ids: number[]; epoch: number } | null>(null);
  const currentFrozenDelete = frozenDelete?.epoch === sessionEpoch ? frozenDelete : null;

  const visibleIds = [...new Set(allNoteIds)];
  const selectedVisibleIds = visibleIds.filter((id) => selectedIds.has(id));
  const hasSelection = selectedVisibleIds.length > 0;
  const isAllSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const isPartialSelection = hasSelection && !isAllSelected;

  // 선택 상태에 따른 텍스트
  const getSelectButtonText = () => {
    if (isAllSelected) {
      return '전체 해제';
    }
    if (isPartialSelection) {
      return '선택 해제';
    }
    return '전체 선택';
  };

  const handleDeleteModeToggle = () => {
    if (isDeleteMode && !hasSelection) {
      // 삭제 모드이지만 선택 없음 → 모드 비활성화
      exitDeleteMode();
    } else if (!isDeleteMode) {
      // 삭제 모드 활성화
      toggleDeleteMode();
    } else if (hasSelection) {
      // 삭제 모드 + 선택 있음 → 삭제 확인 모달
      setFrozenDelete({ ids: selectedVisibleIds, epoch: sessionEpoch });
    }
  };

  const handleDeleteConfirm = () => {
    if (!currentFrozenDelete?.ids.length || isDeleting) return;
    const request = noteDeleteRequest(currentFrozenDelete.ids);
    if (request.sessionEpoch !== currentFrozenDelete.epoch) return;

    deleteNotes(request, {
      onSuccess: () => {
        if (!isCurrentSession(request.sessionEpoch)) return;
        toast.success(`${currentFrozenDelete.ids.length}개의 노트가 삭제되었습니다`);
        exitDeleteMode();
        setFrozenDelete(null);
      },
      onError: () => {
        if (!isCurrentSession(request.sessionEpoch)) return;
        toast.error('노트 삭제에 실패했습니다');
      },
    });
  };

  const handleSelectAll = () => {
    if (hasSelection) {
      // 전체 선택 또는 부분 선택 → 전체 해제
      deselectAll();
    } else {
      // 선택 없음 → 전체 선택
      selectAll(visibleIds);
    }
  };

  const handleClosePanel = () => {
    closePanel();
    requestAnimationFrame(() => document.getElementById('search-panel-toggle')?.focus());
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <h2 className="text-base font-medium">{mode === 'search' ? '검색 결과' : '최근 노트'}</h2>
          {mode === 'search' && (
            <p className="mt-1 truncate text-xs text-muted-foreground">“{query}” 검색</p>
          )}
        </div>
        <button
          id="search-panel-close"
          onClick={handleClosePanel}
          type="button"
          className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/6 hover:text-foreground"
          aria-label="패널 닫기"
          title="패널 닫기"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mx-4 mb-2 flex min-h-11 items-center justify-between gap-2 border-b border-white/8 pb-2 text-xs">
        {isDeleteMode ? (
          <button
            onClick={handleSelectAll}
            type="button"
            aria-pressed={isAllSelected}
            className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-muted-foreground hover:bg-white/6 hover:text-foreground"
            aria-label={getSelectButtonText()}
          >
            <span
              aria-hidden="true"
              className={`flex size-4 items-center justify-center rounded border ${hasSelection ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}
            >
              {hasSelection && <Check className="size-3" />}
            </span>
            {getSelectButtonText()}
          </button>
        ) : (
          <span className="px-1 text-muted-foreground">
            {hasResults ? `${visibleIds.length}개의 노트` : ''}
          </span>
        )}
        <div className="flex items-center gap-1">
          {isDeleteMode && (
            <button
              type="button"
              onClick={exitDeleteMode}
              className="min-h-8 rounded-lg px-2 text-muted-foreground hover:bg-white/6"
              disabled={isDeleting}
            >
              취소
            </button>
          )}
          <button
            onClick={handleDeleteModeToggle}
            type="button"
            className={`flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 transition-colors ${isDeleteMode && hasSelection ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'text-muted-foreground hover:bg-white/6 hover:text-foreground'}`}
            aria-label={
              isDeleteMode
                ? hasSelection
                  ? '선택 항목 삭제'
                  : '삭제 모드 종료'
                : '삭제 모드 활성화'
            }
            aria-pressed={isDeleteMode}
            disabled={isDeleting || (!isDeleteMode && visibleIds.length === 0)}
          >
            {isDeleteMode && hasSelection ? (
              <Trash2 className="size-3.5" aria-hidden="true" />
            ) : (
              <ListChecks className="size-3.5" aria-hidden="true" />
            )}
            {isDeleteMode && hasSelection
              ? `${selectedVisibleIds.length}개 삭제`
              : isDeleteMode
                ? '선택 종료'
                : '선택'}
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      <AlertDialog
        open={currentFrozenDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setFrozenDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>노트 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {currentFrozenDelete?.ids.length ?? 0}개의 노트를 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-white/10 text-white hover:bg-white/20"
              disabled={isDeleting}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteConfirm();
              }}
              className="bg-red-500 text-white hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
