import { type ReactNode, useState, useEffect, useRef } from 'react';

interface SidePeekOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  mode: 'full-screen' | 'side-peek';
  onToggleMode: () => void;
}

/**
 * Side Peek 공통 오버레이 컨테이너
 * - 배경 오버레이 (클릭 시 닫기)
 * - 슬라이드 애니메이션 (왼쪽→오른쪽)
 * - TailwindCSS transform 및 반응형 클래스 사용
 * - 크기 조절 가능 (왼쪽 border 드래그, side-peek 모드에서만)
 * - 전체화면/부분화면 모드 지원
 */
export function SidePeekOverlay({ isOpen, onClose, children, mode }: SidePeekOverlayProps) {
  // 드래그로 설정한 커스텀 너비 (null이면 CSS 반응형 사용)
  const [customWidth, setCustomWidth] = useState<number | null>(null);

  // AbortController ref (이벤트 리스너 정리용)
  const abortControllerRef = useRef<AbortController | null>(null);

  // 컴포넌트 언마운트 시 이벤트 리스너 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      document.body.style.userSelect = '';
    };
  }, []);

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className={`fixed inset-0 z-100 bg-transparent transition-opacity duration-300 ${
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side Peek 패널 */}
      <div
        className={`fixed top-0 right-0 z-110 h-full border-l-2 border-white/30 backdrop-blur-xl transition-all duration-500 ease-out ${
          isOpen
            ? 'pointer-events-auto translate-x-0 animate-slide-in-right opacity-100'
            : 'pointer-events-none translate-x-full opacity-0'
        } ${mode === 'full-screen' ? 'w-full' : 'w-full md:w-3/4 lg:w-2/3 xl:w-1/2 2xl:w-2/5'}`}
        style={mode === 'side-peek' && customWidth ? { width: `${customWidth}%` } : undefined}
        role="dialog"
        aria-modal="true"
      >
        {/* Resize Handle - side-peek 모드에서만 표시 */}
        {mode === 'side-peek' && (
          <div
            className="absolute top-0 left-0 z-120 h-full w-2 cursor-ew-resize transition-colors hover:bg-white/40 active:bg-white/60"
            onMouseDown={(e) => {
              e.preventDefault();

              // 이전 드래그 중단
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
              }

              // 새 AbortController 생성
              const controller = new AbortController();
              abortControllerRef.current = controller;

              // 드래그 상태 추적
              const startX = e.clientX;
              const panelElement = e.currentTarget.parentElement!;
              const startWidthPx = panelElement.offsetWidth;
              const windowWidth = window.innerWidth;

              // 드래그 시작: transition 비활성화 (GPU 과부하 방지)
              panelElement.style.transition = 'none';

              // 드래그 중 크기 조절 (DOM 직접 조작으로 최고 성능)
              const handleMove = (moveEvent: MouseEvent) => {
                const deltaX = startX - moveEvent.clientX;
                const newWidthPx = startWidthPx + deltaX;
                const newWidthPercent = (newWidthPx / windowWidth) * 100;

                // 최소 30%, 최대 95%
                const clampedWidth = Math.min(Math.max(newWidthPercent, 30), 95);

                // DOM 직접 조작 (React 리렌더링 우회)
                panelElement.style.width = `${clampedWidth}%`;
              };

              // 드래그 종료 (최종 상태만 React에 반영)
              const handleUp = () => {
                // transition 복구
                panelElement.style.transition = '';

                // 최종 너비를 React 상태로 동기화
                const finalWidth = parseFloat(panelElement.style.width);
                if (!isNaN(finalWidth)) {
                  setCustomWidth(finalWidth);
                }

                // AbortController로 자동 정리
                controller.abort();
                abortControllerRef.current = null;
                document.body.style.userSelect = '';
              };

              // 이벤트 리스너 등록 (AbortController signal 사용)
              document.body.style.userSelect = 'none';
              document.addEventListener('mousemove', handleMove, { signal: controller.signal });
              document.addEventListener('mouseup', handleUp, { signal: controller.signal });
            }}
            onDoubleClick={() => {
              // 더블클릭으로 커스텀 너비 리셋 (CSS 반응형으로 복귀)
              setCustomWidth(null);
            }}
            onKeyDown={(e) => {
              // 키보드 접근성: ArrowLeft/Right로 크기 조절
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setCustomWidth((prev) => {
                  const current = prev ?? 50; // 기본값 50%
                  return Math.max(current - 5, 30); // 최소 30%
                });
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setCustomWidth((prev) => {
                  const current = prev ?? 50; // 기본값 50%
                  return Math.min(current + 5, 95); // 최대 95%
                });
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // Enter/Space로 커스텀 너비 리셋
                setCustomWidth(null);
              }
            }}
            role="separator"
            aria-label="패널 크기 조절 (화살표 키로 조절, Enter/Space로 초기화)"
            aria-orientation="vertical"
            aria-valuemin={30}
            aria-valuemax={95}
            aria-valuenow={customWidth ? Math.round(customWidth) : undefined}
            tabIndex={0}
          />
        )}

        {children}
      </div>
    </>
  );
}
