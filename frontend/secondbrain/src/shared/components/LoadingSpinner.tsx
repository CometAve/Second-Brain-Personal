import { useEffect, useRef } from 'react';
import logoSvg from '@/shared/components/icon/Logo.svg';
import { startLogoAnimation } from '@/shared/components/loading-logo-renderer';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  fullScreen?: boolean;
  className?: string;
  delayMs?: number;
}

const LOGO_SIZES = { sm: 64, md: 96, lg: 128 } as const;

export function LoadingSpinner({
  size = 'md',
  message,
  fullScreen = true,
  className = '',
  delayMs = 120,
}: LoadingSpinnerProps) {
  const visualRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLImageElement>(null);
  const side = LOGO_SIZES[size];

  useEffect(() => {
    const canvas = canvasRef.current;
    const fallback = fallbackRef.current;
    const visual = visualRef.current;
    if (!canvas || !fallback || !visual) return;

    visual.style.visibility = delayMs > 0 ? 'hidden' : 'visible';
    canvas.style.opacity = '0';
    fallback.style.visibility = 'inherit';
    let stop: (() => void) | undefined;
    // Skip a visual flash for fast work. This never delays ready content.
    const start = () => {
      visual.style.visibility = 'visible';
      stop = startLogoAnimation(canvas, side, () => {
        canvas.style.opacity = '1';
        fallback.style.visibility = 'hidden';
      });
    };
    const timer = delayMs > 0 ? window.setTimeout(start, delayMs) : undefined;
    if (delayMs <= 0) start();
    return () => {
      window.clearTimeout(timer);
      stop?.();
      visual.style.visibility = 'hidden';
      canvas.style.opacity = '0';
      fallback.style.visibility = 'inherit';
    };
  }, [side, delayMs]);

  return (
    <div
      role="status"
      aria-label={message ?? '불러오는 중'}
      className={`flex items-center justify-center ${fullScreen ? 'min-h-dvh' : 'min-h-0'} ${className}`}
    >
      <div
        ref={visualRef}
        className={`relative shrink-0 ${delayMs > 0 ? 'invisible' : ''}`}
        style={{ width: side, height: side }}
      >
        <img
          ref={fallbackRef}
          src={logoSvg}
          alt=""
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 h-[85.88%] w-[120.59%] max-w-none -translate-1/2 object-contain"
        />
        <canvas
          ref={canvasRef}
          width={side}
          height={side}
          aria-hidden="true"
          className="absolute inset-0 size-full opacity-0"
        />
        {message && (
          <p
            aria-hidden="true"
            className="absolute top-full left-1/2 mt-3 w-max max-w-[min(24rem,80vw)] -translate-x-1/2 text-center text-sm text-muted-foreground"
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
