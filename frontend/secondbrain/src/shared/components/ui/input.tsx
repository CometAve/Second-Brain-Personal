import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Input 컴포넌트 Props
 * HTMLInputElement의 모든 속성 상속
 */
type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * 재사용 가능한 Input 컴포넌트
 * Tailwind CSS 기반, Glass morphism 스타일 적용
 *
 * @example
 * <Input
 *   type="text"
 *   placeholder="입력하세요"
 *   value={value}
 *   onChange={handleChange}
 * />
 *
 * @example
 * <Input
 *   readOnly
 *   value={apiKey}
 *   className="font-mono text-xs"
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full rounded-sm border border-white/20 bg-white/5 px-3 py-2 text-sm text-white',
        'placeholder:text-white/50',
        'focus:border-white/40 focus:ring-2 focus:ring-white/20 focus:outline-hidden',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'read-only:cursor-default read-only:focus:ring-0',
        'transition-colors duration-150',
        'motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';
