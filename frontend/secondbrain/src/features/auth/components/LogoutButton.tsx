import { useLogout } from '@/features/auth/hooks/useLogout';
import { captureSessionEpoch } from '@/stores/authStore';

/**
 * 로그아웃 버튼 컴포넌트
 * - useLogout 훅을 사용하여 로그아웃 처리
 * - 로딩 상태 표시
 * - variant='menu-item'으로 드롭다운 메뉴 스타일 지원
 */

interface LogoutButtonProps {
  variant?: 'primary' | 'secondary' | 'menu-item';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  onLogoutStart?: () => void;
}

export function LogoutButton({
  variant = 'secondary',
  size = 'md',
  icon,
  onLogoutStart,
}: LogoutButtonProps) {
  const { mutate: logout, isPending } = useLogout();

  function handleLogout() {
    const epoch = captureSessionEpoch();
    onLogoutStart?.();
    logout(epoch);
  }

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
    'menu-item':
      'w-full text-left bg-transparent text-destructive hover:bg-destructive/8 focus:ring-white/20 flex items-center gap-2 transition-colors duration-150 ease-in-out motion-reduce:transition-none',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      role={variant === 'menu-item' ? 'menuitem' : undefined}
      className={`rounded-lg font-medium focus:ring-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {variant === 'menu-item' && icon && <span className="shrink-0">{icon}</span>}
      <span>{isPending ? '로그아웃 중...' : '로그아웃'}</span>
    </button>
  );
}
