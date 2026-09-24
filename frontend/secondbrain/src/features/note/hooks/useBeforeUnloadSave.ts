import { useRef, useEffect } from 'react';

interface UseBeforeUnloadSaveOptions {
  draftId: string;
  getTitle: () => string;
  getContent: () => string;
  shouldSkip?: () => boolean;
}

/**
 * 페이지 이탈 시 자동 저장 훅
 * - beforeunload 이벤트에서 navigator.sendBeacon으로 저장
 * - shouldSkip이 true면 저장하지 않음 (이미 저장 중인 경우 등)
 */
export function useBeforeUnloadSave({
  draftId,
  getTitle,
  getContent,
  shouldSkip,
}: UseBeforeUnloadSaveOptions): void {
  // beforeunload 핸들러를 ref로 저장하여 최신 값 참조 보장
  const handleBeforeUnloadRef = useRef<(() => void) | undefined>(undefined);

  handleBeforeUnloadRef.current = () => {
    // shouldSkip이 true면 저장하지 않음
    if (shouldSkip?.()) {
      return;
    }

    const title = getTitle();
    const content = getContent();

    // title과 content가 모두 있을 때만 저장
    if (title.trim() && content.trim()) {
      navigator.sendBeacon(
        `/api/notes/from-draft/${draftId}`,
        new Blob(
          [
            JSON.stringify({
              title,
              content,
            }),
          ],
          {
            type: 'application/json',
          },
        ),
      );
    }
  };

  // 이벤트 리스너 등록 (마운트 시 한 번만)
  useEffect(() => {
    const handleBeforeUnload = (): void => {
      handleBeforeUnloadRef.current?.();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
