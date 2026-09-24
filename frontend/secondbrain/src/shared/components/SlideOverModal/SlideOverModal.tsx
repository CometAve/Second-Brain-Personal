import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SlideOverModalProps } from '@/shared/components/SlideOverModal/SlideOverModal.types';

/**
 * 슬라이드 오버레이 모달 컴포넌트
 * - Notion Side Peek 스타일
 * - 화면 우측/좌측에서 슬라이드
 * - Backdrop + translateX 애니메이션
 * - Portal을 통한 body 직접 렌더링
 */
export function SlideOverModal({
  isOpen,
  onClose,
  children,
  width = '50%',
  direction = 'right',
  closeOnEscape = true,
}: SlideOverModalProps) {
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

  if (!isOpen) return null;

  const slideDirection = direction === 'right' ? 'translate-x-0' : '-translate-x-0';
  const initialPosition = direction === 'right' ? 'translate-x-full' : '-translate-x-full';
  const position = direction === 'right' ? 'right-0' : 'left-0';

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-end">
      {/* Modal Content */}
      <div
        className={`relative h-full transition-transform duration-300 ease-out motion-reduce:transition-none ${position} ${isOpen ? slideDirection : initialPosition}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
