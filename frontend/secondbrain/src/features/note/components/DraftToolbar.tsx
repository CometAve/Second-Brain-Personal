import { Check, PanelRightClose, Trash2, Expand, X } from 'lucide-react';
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

type DraftToolbarProps = {
  onBack: () => void;
  onDelete?: () => void;
  mode: 'full-screen' | 'side-peek';
  onToggleMode: () => void;
  hideSidePeekButton?: boolean;
  disabled?: boolean;
  status?: string;
  error?: string | null;
  onSave?: () => void;
  saveDisabled?: boolean;
  closeLabel?: string;
  deleteLabel?: string;
};

const BUTTON_CLASS =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#3b465c] bg-[#202838] px-3 text-sm font-medium text-[#dce4ef] transition-colors hover:border-[#6c6d9d] hover:bg-[#293248] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b4a4f6] disabled:cursor-not-allowed disabled:opacity-40';

/** A fixed header reserves space for both progress and errors, independently of the document. */
export function DraftToolbar({
  onBack,
  onDelete,
  mode,
  onToggleMode,
  hideSidePeekButton = false,
  disabled = false,
  status = '',
  error,
  onSave,
  saveDisabled = false,
  closeLabel = '닫기',
  deleteLabel = '노트 삭제',
}: DraftToolbarProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-24 flex-col border-b border-[#303a4e] bg-[#171d29] px-4 py-2.5 sm:px-8">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-xs text-[#aeb9c9] sm:text-sm"
        >
          {status}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={saveDisabled || disabled}
              className={`${BUTTON_CLASS} border-[#8275c1] bg-[#34365b] text-[#eee9ff] hover:bg-[#414576]`}
            >
              저장
            </button>
          )}
          {!hideSidePeekButton && (
            <button
              type="button"
              onClick={onToggleMode}
              className={BUTTON_CLASS}
              aria-label={mode === 'full-screen' ? '사이드 보기' : '전체화면'}
              title={mode === 'full-screen' ? '사이드 보기' : '전체화면'}
            >
              {mode === 'full-screen' ? (
                <PanelRightClose className="size-5" />
              ) : (
                <Expand className="size-5" />
              )}
            </button>
          )}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  className={BUTTON_CLASS}
                  aria-label={deleteLabel}
                  title={deleteLabel}
                  disabled={disabled}
                >
                  <Trash2 className="size-4.5 text-[#f3a7aa]" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{deleteLabel}</AlertDialogTitle>
                  <AlertDialogDescription>
                    정말 삭제하시겠습니까? 삭제한 내용은 복구할 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} disabled={disabled}>
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <button
            type="button"
            onClick={onBack}
            className={BUTTON_CLASS}
            aria-label={closeLabel}
            title={closeLabel}
            disabled={disabled}
          >
            {closeLabel === '닫기' ? <X className="size-4.5" /> : <Check className="size-4.5" />}
            <span className="hidden sm:inline">{closeLabel}</span>
          </button>
        </div>
      </div>
      <div className="mt-1 min-h-0 flex-1 overflow-y-auto text-xs leading-4 text-[#ffb5b8] sm:text-sm">
        {error && <p role="alert">{error}</p>}
      </div>
    </header>
  );
}
