import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils';

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
};
const BUTTON_VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/85',
  secondary: 'border border-white/10 bg-white/5 text-foreground hover:bg-white/10',
  destructive: 'bg-destructive/12 text-destructive hover:bg-destructive/20',
  ghost: 'bg-transparent text-muted-foreground hover:bg-white/6 hover:text-foreground',
};
const BUTTON_SIZES = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-12 px-6 text-base',
  icon: 'size-10 shrink-0 p-2.5',
};
export function Button({
  className,
  variant = 'secondary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
