import * as React from 'react';
import { cn } from '@/lib/utils/utils';

/**
 * Simple CSS-only Tooltip for Shadow DOM
 * - Radix UI Tooltip의 positioning이 Shadow DOM에서 작동하지 않아 대체
 */

interface SimpleTooltipProps {
  children: React.ReactElement;
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right' | 'left-bottom';
}

export function SimpleTooltip({ children, content, side = 'bottom' }: SimpleTooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => {
        setIsVisible(true);
      }}
      onMouseLeave={() => {
        setIsVisible(false);
      }}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'pointer-events-none absolute z-99999 rounded-md bg-foreground px-3 py-1.5 text-xs whitespace-nowrap text-background shadow-lg',
            side === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2',
            side === 'bottom' && 'top-full left-0 mt-2',
            side === 'left' && 'top-1/2 right-full mr-2 -translate-y-1/2',
            side === 'right' && 'top-1/2 left-full ml-2 -translate-y-1/2',
            side === 'left-bottom' && 'top-full right-0 mt-2 translate-x-1/2',
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
