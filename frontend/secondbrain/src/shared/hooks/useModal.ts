import { useEffect, useRef } from 'react';

export interface UseModalOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
}

export interface UseModalReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * 모달 공통 로직을 추상화한 커스텀 훅
 * - 외부 클릭 감지
 * - Escape 키 처리
 * - Body scroll lock
 */
export function useModal({
  isOpen,
  onClose,
  closeOnOutsideClick = true,
  closeOnEscape = true,
}: UseModalOptions): UseModalReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // 약간의 지연을 두어 토글 클릭과 외부 클릭이 충돌하지 않도록 함
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen, closeOnOutsideClick, onClose]);

  // Escape 키 처리
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeOnEscape, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  return {
    containerRef,
    contentRef,
  };
}
