import { useEffect, useRef } from 'react';

interface UseKeyboardNavOptions {
  /**
   * 키보드 네비게이션 활성화 여부
   */
  enabled: boolean;

  /**
   * 메뉴 열림/닫힘 상태
   */
  isOpen: boolean;

  /**
   * 메뉴 컨텐츠 ref
   */
  contentRef: React.RefObject<HTMLElement | null>;

  /**
   * 메뉴 아이템 선택자 (기본: '[role="menuitem"]')
   */
  menuItemSelector?: string;

  /**
   * 순환 네비게이션 활성화 (기본: true)
   * - true: 마지막 항목에서 ArrowDown → 첫 번째 항목
   * - false: 마지막 항목에서 ArrowDown → 마지막 항목 유지
   */
  loop?: boolean;
}

/**
 * ARIA 메뉴 패턴을 따르는 키보드 네비게이션 훅
 *
 * @description
 * - WAI-ARIA Authoring Practices 준수
 * - ArrowDown/ArrowUp: 다음/이전 항목 포커스
 * - Home/End: 첫/마지막 항목 포커스
 * - Tab/Shift+Tab: 다음/이전 항목 포커스 (순환)
 * - 첫 방향키 입력 감지 및 자동 포커스
 *
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/menu/
 *
 * @example
 * ```tsx
 * const contentRef = useRef<HTMLDivElement>(null);
 *
 * useKeyboardNav({
 *   enabled: true,
 *   isOpen,
 *   contentRef,
 * });
 *
 * return (
 *   <div ref={contentRef}>
 *     <button role="menuitem">Option 1</button>
 *     <button role="menuitem">Option 2</button>
 *   </div>
 * );
 * ```
 */
export function useKeyboardNav({
  enabled,
  isOpen,
  contentRef,
  menuItemSelector = '[role="menuitem"]',
  loop = true,
}: UseKeyboardNavOptions): void {
  const hasNavigatedRef = useRef(false);

  // 키보드 네비게이션
  useEffect(() => {
    if (!enabled || !isOpen) return;

    // effect 시작 시 자동 초기화
    hasNavigatedRef.current = false;

    const contentElement = contentRef.current;
    if (!contentElement) return;

    const menuItems = contentElement.querySelectorAll<HTMLElement>(menuItemSelector);
    if (menuItems.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      const activeElement = document.activeElement as HTMLElement;
      const currentIndex = Array.from(menuItems).indexOf(activeElement);

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          if (!hasNavigatedRef.current) {
            // 첫 방향키: 첫 번째 항목 포커스
            hasNavigatedRef.current = true;
            menuItems[0].focus();
          } else {
            // 다음 항목 포커스 (순환 옵션에 따라)
            const nextIndex = loop
              ? (currentIndex + 1) % menuItems.length
              : Math.min(currentIndex + 1, menuItems.length - 1);
            menuItems[nextIndex].focus();
          }
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          if (!hasNavigatedRef.current) {
            // 첫 방향키: 마지막 항목 포커스
            hasNavigatedRef.current = true;
            menuItems[menuItems.length - 1].focus();
          } else {
            // 이전 항목 포커스 (순환 옵션에 따라)
            const prevIndex = loop
              ? (currentIndex - 1 + menuItems.length) % menuItems.length
              : Math.max(currentIndex - 1, 0);
            menuItems[prevIndex].focus();
          }
          break;
        }

        case 'Home':
          event.preventDefault();
          hasNavigatedRef.current = true;
          menuItems[0].focus();
          break;

        case 'End':
          event.preventDefault();
          hasNavigatedRef.current = true;
          menuItems[menuItems.length - 1].focus();
          break;

        case 'Tab': {
          event.preventDefault();
          hasNavigatedRef.current = true;
          const tabIndex = event.shiftKey
            ? (currentIndex - 1 + menuItems.length) % menuItems.length
            : (currentIndex + 1) % menuItems.length;
          menuItems[tabIndex].focus();
          break;
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, isOpen, contentRef, menuItemSelector, loop]);
}
