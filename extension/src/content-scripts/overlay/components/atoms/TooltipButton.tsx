import { Button } from '@/content-scripts/overlay/components/ui/button';
import { SimpleTooltip } from '@/content-scripts/overlay/components/ui/simple-tooltip';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/content-scripts/overlay/components/ui/buttonVariants';

/**
 * Tooltip Button (Atom)
 * - 재사용 가능한 Tooltip이 있는 버튼
 * - Icon + Simple CSS Tooltip 조합
 */
interface TooltipButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  className?: string;
}

export function TooltipButton({
  icon,
  tooltip,
  onClick,
  variant = 'ghost',
  size = 'icon-sm',
  className,
}: TooltipButtonProps) {
  return (
    <SimpleTooltip content={tooltip} side="bottom">
      <Button variant={variant} size={size} onClick={onClick} className={className}>
        {icon}
        <span className="sr-only">{tooltip}</span>
      </Button>
    </SimpleTooltip>
  );
}
