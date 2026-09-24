import { ChevronsRight, PanelRightClose, Trash2, Expand } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog';

interface DraftToolbarProps {
  onBack: () => void;
  onDelete: () => void;
  mode: 'full-screen' | 'side-peek';
  onToggleMode: () => void;
  hideSidePeekButton?: boolean;
}

/**
 * Draft 툴바
 * - 전체화면 모드: ChevronsRight (닫기), PanelRightClose (사이드 보기), Trash2 (삭제)
 * - 부분화면 모드: Expand (전체화면), Trash2 (삭제)
 * - Tooltip이 모든 버튼에 적용됨
 * - 삭제 버튼은 AlertDialog로 확인 후 실행
 */
export function DraftToolbar({
  onBack,
  onDelete,
  mode,
  onToggleMode,
  hideSidePeekButton = false,
}: DraftToolbarProps) {
  // 공통 버튼 스타일
  const buttonClass = `
    rounded-lg border border-white/30 bg-white/10 p-3
    backdrop-blur-lg transition-colors
    hover:bg-white/20 active:bg-white/30
  `;

  return (
    <TooltipProvider>
      {mode === 'full-screen' ? (
        // 전체화면 모드: 우측 상단에 3개 버튼
        <div className="fixed top-10 right-10 z-10 flex gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onBack} className={buttonClass} aria-label="닫기">
                <ChevronsRight className="size-6 text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent>닫기</TooltipContent>
          </Tooltip>

          {!hideSidePeekButton && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleMode} className={buttonClass} aria-label="사이드 보기">
                  <PanelRightClose className="size-6 text-white" />
                </button>
              </TooltipTrigger>
              <TooltipContent>사이드 보기</TooltipContent>
            </Tooltip>
          )}

          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <button className={buttonClass} aria-label="노트 삭제">
                    <Trash2 className="size-6 text-red-500" />
                  </button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent>노트 삭제</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>노트 삭제</AlertDialogTitle>
                <AlertDialogDescription>이 노트를 삭제하시겠습니까?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        // 부분화면 모드: 좌측 Expand (전체화면), 우측 Trash2 (삭제)
        <>
          <div className="fixed top-10 left-10 z-10">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onToggleMode} className={buttonClass} aria-label="전체화면">
                  <Expand className="size-6 text-white" />
                </button>
              </TooltipTrigger>
              <TooltipContent>전체화면</TooltipContent>
            </Tooltip>
          </div>

          <div className="fixed top-10 right-10 z-10">
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <button className={buttonClass} aria-label="노트 삭제">
                      <Trash2 className="size-6 text-red-500" />
                    </button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>노트 삭제</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>노트 삭제</AlertDialogTitle>
                  <AlertDialogDescription>이 노트를 삭제하시겠습니까?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>삭제</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </TooltipProvider>
  );
}
