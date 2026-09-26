import { useEffect } from 'react';

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
  onTabExit?: () => void;

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
 * - Tab/Shift+Tab: 브라우저 기본 순서로 이동해 메뉴 밖으로 나갈 수 있음
 * - 메뉴를 열면 첫 항목에 포커스
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
  onTabExit,
  menuItemSelector = '[role="menuitem"]',
  loop = true,
}: UseKeyboardNavOptions): void {
  useEffect(() => {
    if (enabled && isOpen) {
      contentRef.current?.querySelector<HTMLElement>(menuItemSelector)?.focus();
    }
  }, [enabled, isOpen, contentRef, menuItemSelector]);

  useEffect(() => {
    if (!enabled || !isOpen) return;

    const contentElement = contentRef.current;
    if (!contentElement) return;
    let tabTimeout: number | undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || !contentElement) return;
      if (event.key === 'Tab') {
        window.clearTimeout(tabTimeout);
        tabTimeout = window.setTimeout(() => {
          if (!contentElement.contains(document.activeElement)) onTabExit?.();
        }, 0);
        return;
      }
      const menuItems = [...contentElement.querySelectorAll<HTMLElement>(menuItemSelector)];
      const currentIndex = menuItems.indexOf(document.activeElement as HTMLElement);
      if (currentIndex < 0) return;

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault();
          const nextIndex = loop
            ? (currentIndex + 1) % menuItems.length
            : Math.min(currentIndex + 1, menuItems.length - 1);
          menuItems[nextIndex].focus();
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          const prevIndex = loop
            ? (currentIndex - 1 + menuItems.length) % menuItems.length
            : Math.max(currentIndex - 1, 0);
          menuItems[prevIndex].focus();
          break;
        }

        case 'Home':
          event.preventDefault();
          menuItems[0].focus();
          break;

        case 'End':
          event.preventDefault();
          menuItems[menuItems.length - 1].focus();
          break;
      }
    }

    contentElement.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(tabTimeout);
      contentElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, isOpen, contentRef, menuItemSelector, loop, onTabExit]);
}
