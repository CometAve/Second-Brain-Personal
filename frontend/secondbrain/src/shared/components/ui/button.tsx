import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Button 컴포넌트 Props
 */
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 버튼 스타일 변형
   * - primary: 주요 액션 (파란색 배경)
   * - secondary: 보조 액션 (반투명 흰색 배경)
   * - destructive: 위험한 액션 (빨간색 배경)
   * - ghost: 배경 없는 버튼
   */
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  /**
   * 버튼 크기
   * - sm: 작은 크기
   * - md: 중간 크기 (기본값)
   * - lg: 큰 크기
   * - icon: 아이콘 전용 (정사각형)
   */
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

/**
 * 재사용 가능한 Button 컴포넌트
 * Tailwind CSS 기반, variant 및 size 지원
 *
 * @example
 * <Button variant="primary" size="sm" onClick={handleClick}>
 *   클릭
 * </Button>
 *
 * @example
 * <Button variant="ghost" size="icon">
 *   <Icon />
 * </Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
      secondary: 'bg-white/10 text-white hover:bg-white/20 focus:ring-white/20',
      destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      ghost: 'bg-transparent text-white hover:bg-white/10 focus:ring-white/20',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
      icon: 'p-2',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'rounded-sm font-medium transition-colors duration-150 focus:ring-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          'flex items-center justify-center gap-2',
          'motion-reduce:transition-none',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
