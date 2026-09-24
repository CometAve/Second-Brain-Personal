import { useState } from 'react';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import DoubleArrow from '@/shared/components/icon/DoubleArrow.svg?react';
import DeleteIcon from '@/shared/components/icon/Delete.svg?react';
import { Check } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
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
import { useNoteDelete } from '@/features/note/hooks/useNoteDelete';
import { toast } from 'sonner';

interface PanelHeaderProps {
  allNoteIds: number[];
}

export function PanelHeader({ allNoteIds }: PanelHeaderProps) {
  const closePanel = useSearchPanelStore((state) => state.closePanel);
  const isDeleteMode = useSearchPanelStore((state) => state.isDeleteMode);
  const toggleDeleteMode = useSearchPanelStore((state) => state.toggleDeleteMode);
  const exitDeleteMode = useSearchPanelStore((state) => state.exitDeleteMode);
  const selectedIds = useSearchPanelStore((state) => state.selectedIds);
  const selectAll = useSearchPanelStore((state) => state.selectAll);
  const deselectAll = useSearchPanelStore((state) => state.deselectAll);
  const isSelectAllMode = useSearchPanelStore((state) => state.isSelectAllMode);

  const { mutate: deleteNotes, isPending: isDeleting } = useNoteDelete();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasSelection = selectedIds.size > 0;
  const isPartialSelection = hasSelection && !isSelectAllMode;

  // 선택 상태에 따른 텍스트
  const getSelectButtonText = () => {
    if (isSelectAllMode) {
      return '전체해제';
    }
    if (isPartialSelection) {
      return '선택해제';
    }
    return '전체선택';
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
      setShowDeleteConfirm(true);
    }
  };

  const handleDeleteConfirm = () => {
    if (!hasSelection || isDeleting) return;

    deleteNotes(
      { noteIds: Array.from(selectedIds) },
      {
        onSuccess: () => {
          toast.success(`${selectedIds.size}개의 노트가 삭제되었습니다`);
          exitDeleteMode();
          setShowDeleteConfirm(false);
        },
        onError: (error) => {
          console.error('노트 삭제 실패:', error);
          toast.error('노트 삭제에 실패했습니다');
          setShowDeleteConfirm(false);
        },
      },
    );
  };

  const handleSelectAll = () => {
    if (isSelectAllMode || isPartialSelection) {
      // 전체 선택 또는 부분 선택 → 전체 해제
      deselectAll();
    } else {
      // 선택 없음 → 전체 선택
      selectAll(allNoteIds);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TooltipProvider delayDuration={300}>
            {/* 전체 선택 버튼 - 삭제 모드일 때만 표시 */}
            {isDeleteMode && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 transition-all duration-200 hover:bg-white/10 hover:text-white"
                aria-label={getSelectButtonText()}
              >
                <div
                  className={`flex size-6 items-center justify-center rounded-md border-2 transition-all ${
                    isSelectAllMode || isPartialSelection
                      ? 'border-green-500 bg-white text-green-500'
                      : 'border-white/80 bg-transparent'
                  }`}
                >
                  {(isSelectAllMode || isPartialSelection) && (
                    <Check className="size-4 stroke-3 text-green-500" />
                  )}
                </div>
                <span className="font-medium">{getSelectButtonText()}</span>
              </button>
            )}

            {/* 삭제 버튼 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleDeleteModeToggle}
                  className={`rounded-lg p-2 transition-all duration-200 ${
                    isDeleteMode
                      ? 'border-2 border-red-500 bg-red-500/20 text-red-400 hover:scale-110 hover:bg-red-500/30'
                      : 'text-white/80 hover:scale-110 hover:bg-white/10 hover:text-white'
                  }`}
                  aria-label={
                    isDeleteMode
                      ? hasSelection
                        ? '선택 항목 삭제'
                        : '삭제 모드 종료'
                      : '삭제 모드 활성화'
                  }
                  aria-pressed={isDeleteMode}
                  disabled={isDeleting}
                >
                  <DeleteIcon className="size-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={5}>
                <p>
                  {isDeleteMode
                    ? hasSelection
                      ? '선택 항목 삭제'
                      : '삭제 모드 종료'
                    : '삭제 모드'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <TooltipProvider delayDuration={300}>
          {/* 닫기 버튼 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={closePanel}
                className="rounded-lg p-2 text-white/80 transition-all duration-200 hover:scale-110 hover:bg-white/10 hover:text-white"
                aria-label="패널 닫기"
              >
                <DoubleArrow className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={5}>
              <p>패널 닫기</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 삭제 확인 모달 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>노트 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              선택한 {selectedIds.size}개의 노트를 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 text-white hover:bg-white/20">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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
