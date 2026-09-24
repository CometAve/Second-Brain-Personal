import { useModal } from '@/shared/hooks/useModal';
import { useKeyboardNav } from '@/shared/hooks/useKeyboardNav';
import type { DropdownProps } from '@/shared/components/Dropdown/Dropdown.types';

const positionClasses = {
  'bottom-right': 'right-0 top-full mt-2',
  'bottom-left': 'left-0 top-full mt-2',
  'top-right': 'right-0 bottom-full mb-2',
  'top-left': 'left-0 bottom-full mb-2',
};

/**
 * 드롭다운 컴포넌트
 * - 작은 드롭다운 메뉴용
 * - 절대 위치 기반
 * - 페이드 + translateY 애니메이션
 * - 키보드 네비게이션 지원
 */
export function Dropdown({
  isOpen,
  onClose,
  children,
  className = '',
  position = 'bottom-right',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  enableKeyboardNav = true,
}: DropdownProps) {
  const { containerRef, contentRef } = useModal({
    isOpen,
    onClose,
    closeOnOutsideClick,
    closeOnEscape,
  });

  // 키보드 네비게이션: WAI-ARIA 메뉴 패턴
  useKeyboardNav({
    enabled: enableKeyboardNav,
    isOpen,
    contentRef,
  });

  return (
    <div
      ref={containerRef}
      className={`absolute z-60 ${positionClasses[position]} transition-all duration-200 ease-out motion-reduce:transition-none ${
        isOpen
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
          : 'pointer-events-none -translate-y-2 scale-95 opacity-0'
      } ${className}`}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
