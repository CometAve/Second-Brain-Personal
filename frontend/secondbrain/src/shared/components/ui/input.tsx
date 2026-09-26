import type { ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/utils';
type InputProps = ComponentPropsWithRef<'input'>;
export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'min-h-10 w-full rounded-lg border border-input bg-white/3 px-3 py-2 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground read-only:cursor-default focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  );
}
