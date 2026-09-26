import { useCallback, useState, useSyncExternalStore } from 'react';

interface ManualWidth {
  width: number;
  viewportWidth: number;
  breakpoints: Record<number, number>;
  defaultWidth: number;
}

function getViewportWidth() {
  return window.innerWidth;
}

function getServerViewportWidth() {
  return 0;
}

function sameBreakpoints(left: Record<number, number>, right: Record<number, number>) {
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => left[Number(key)] === right[Number(key)])
  );
}

function getBreakpointWidth(
  viewportWidth: number,
  breakpoints: Record<number, number>,
  defaultWidth: number,
) {
  const sortedBreakpoints = Object.keys(breakpoints)
    .map(Number)
    .sort((a, b) => b - a);

  for (const breakpoint of sortedBreakpoints) {
    if (viewportWidth >= breakpoint) return breakpoints[breakpoint];
  }
  return defaultWidth;
}

interface UseResponsiveWidthOptions {
  /**
   * 브레이크포인트별 너비 설정
   * - key: 브레이크포인트 (px)
   * - value: 너비 (%)
   *
   * @example
   * ```
   * {
   *   1536: 40,  // 2xl
   *   1280: 50,  // xl
   *   1024: 66.67, // lg
   *   768: 75,   // md
   *   0: 100,    // mobile
   * }
   * ```
   */
  breakpoints: Record<number, number>;

  /**
   * 초기 너비 (기본: 50)
   */
  defaultWidth?: number;
}

interface UseResponsiveWidthReturn {
  /**
   * 현재 너비 (%)
   */
  width: number;

  /**
   * 수동으로 너비 설정하는 함수
   * - 드래그 리사이즈 등에서 사용
   */
  setWidth: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * 브레이크포인트 기반 반응형 너비 관리 훅
 *
 * @description
 * - 화면 크기에 따라 자동으로 너비 조정
 * - TailwindCSS 브레이크포인트와 호환
 * - resize 이벤트 최적화 (debounce 불필요)
 * - 수동 너비 조정 지원 (드래그 리사이즈)
 *
 * @example
 * ```tsx
 * const { width, setWidth } = useResponsiveWidth({
 *   breakpoints: {
 *     1536: 40,  // 2xl: 화면이 1536px 이상일 때 40% 너비
 *     1280: 50,  // xl: 화면이 1280px 이상일 때 50% 너비
 *     1024: 66.67, // lg: 화면이 1024px 이상일 때 66.67% 너비
 *     768: 75,   // md: 화면이 768px 이상일 때 75% 너비
 *     0: 100,    // mobile: 화면이 768px 미만일 때 100% 너비
 *   },
 * });
 *
 * // 드래그 리사이즈
 * const handleDrag = (newWidth: number) => {
 *   setWidth(newWidth);
 * };
 *
 * return <div style={{ width: `${width}%` }}>Content</div>;
 * ```
 */
export function useResponsiveWidth({
  breakpoints,
  defaultWidth = 50,
}: UseResponsiveWidthOptions): UseResponsiveWidthReturn {
  const [manualWidth, setManualWidth] = useState<ManualWidth | null>(null);
  const subscribeToWindowResize = useCallback((onResize: () => void) => {
    const handleResize = () => {
      setManualWidth(null);
      onResize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const viewportWidth = useSyncExternalStore(
    subscribeToWindowResize,
    getViewportWidth,
    getServerViewportWidth,
  );
  const breakpointWidth = getBreakpointWidth(viewportWidth, breakpoints, defaultWidth);
  const manualWidthIsCurrent =
    manualWidth?.viewportWidth === viewportWidth &&
    manualWidth.defaultWidth === defaultWidth &&
    sameBreakpoints(manualWidth.breakpoints, breakpoints);
  if (manualWidth && !manualWidthIsCurrent) setManualWidth(null);
  const width = manualWidthIsCurrent ? manualWidth.width : breakpointWidth;

  const setWidth = useCallback<React.Dispatch<React.SetStateAction<number>>>(
    (nextWidth) => {
      setManualWidth((previous) => {
        const previousWidth =
          previous?.viewportWidth === viewportWidth &&
          previous.defaultWidth === defaultWidth &&
          sameBreakpoints(previous.breakpoints, breakpoints)
            ? previous.width
            : breakpointWidth;
        return {
          width: typeof nextWidth === 'function' ? nextWidth(previousWidth) : nextWidth,
          viewportWidth,
          breakpoints: { ...breakpoints },
          defaultWidth,
        };
      });
    },
    [viewportWidth, breakpoints, defaultWidth, breakpointWidth],
  );

  return { width, setWidth };
}
