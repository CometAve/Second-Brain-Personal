import type { ReactNode } from 'react';
import '@/shared/styles/glass-base.css';

interface GlassContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * 글래스 모피즘 컨테이너 컴포넌트
 * - 패널형 레이아웃을 위한 전체 높이 글래스 컨테이너
 * - z-index 레이어링: 글래스 효과(z-10) + 콘텐츠(z-20)
 * - 내부 콘텐츠는 flex column 레이아웃
 */
export function GlassContainer({ children, className = '' }: GlassContainerProps) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-3xl bg-white/15 p-6 font-medium text-white shadow-[0px_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-[3.5px] backdrop-saturate-180 ${className}`}
    >
      {/* Glass border effects */}
      <span className="glass-border pointer-events-none absolute inset-0 z-10 rounded-3xl p-px opacity-20 mix-blend-screen"></span>
      <span className="glass-border pointer-events-none absolute inset-0 z-10 rounded-3xl p-px mix-blend-overlay"></span>

      {/* Content layer */}
      <div className="relative z-20 flex h-full flex-col">{children}</div>
    </div>
  );
}
