import { useEffect, useState } from 'react';
import { SimpleTooltip } from '@/content-scripts/overlay/components/ui/simple-tooltip';

/**
 * Floating Button (Atom)
 * - Overlay가 collapsed 상태일 때 표시
 * - 동그라미 버튼
 * - SecondBrain 아이콘 표시
 * - 라이트 모드 색상 고정, 테두리는 시스템 테마에 따라 변경
 * - 다크모드: 흰색 border, 라이트모드: 검은색 border
 * - Positioning은 부모 컴포넌트에서 관리
 */
interface FloatingButtonProps {
  onClick: () => void;
}

export function FloatingButton({ onClick }: FloatingButtonProps) {
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <SimpleTooltip content="Second Brain" side="left-bottom">
      <button
        onClick={onClick}
        className="inline-flex size-10 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
        style={{
          backgroundColor: 'oklch(0.25 0 0)',
          border: isDarkMode ? '2px solid white' : '2px solid black',
        }}
      >
        <img src={chrome.runtime.getURL('/assets/icon.png')} alt="SecondBrain" className="size-6" />
      </button>
    </SimpleTooltip>
  );
}
