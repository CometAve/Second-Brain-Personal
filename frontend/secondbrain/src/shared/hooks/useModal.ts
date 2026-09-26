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
 * - Escape로 닫을 때 트리거에 포커스 복귀
 */
export function useModal({
  isOpen,
  onClose,
  closeOnOutsideClick = true,
  closeOnEscape = true,
}: UseModalOptions): UseModalReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen || !closeOnOutsideClick) return;

    function handleClickOutside(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (containerRef.current && !containerRef.current.contains(target)) {
        onClose();
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen, closeOnOutsideClick, onClose]);

  // Escape 키 처리
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        if (triggerRef.current?.isConnected) triggerRef.current.focus();
      }
    }

    const container = containerRef.current;
    container?.addEventListener('keydown', handleEscape);

    return () => {
      container?.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeOnEscape, onClose]);

  return {
    containerRef,
    contentRef,
  };
}
