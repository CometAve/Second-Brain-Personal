import { ToggleSwitch } from '@/shared/components/ToggleSwitch/ToggleSwitch';
import { useAuthStore } from '@/stores/authStore';
import { useReminderToggle } from '@/features/reminder/hooks/useReminderToggle';

/**
 * 리마인더 알림 설정 토글 메뉴 아이템
 * - UserProfileMenu에서 사용
 * - Hybrid 패턴: Zustand + TanStack Query 함께 사용
 * - 백엔드 POST /api/users/reminder API 연동
 * - Optimistic UI 패턴 적용
 * - 로딩 상태 자동 처리
 * - 전체 항목 클릭 지원 (ToggleSwitch 직접 클릭 시 중복 방지)
 * - 키보드 네비게이션 지원 (Enter/Space)
 */
export function ReminderToggleMenuItem() {
  const { user } = useAuthStore();
  const { toggle, isLoading } = useReminderToggle();

  if (!user) return null;

  // 전체 항목 클릭 핸들러
  const handleClick = (e: React.MouseEvent) => {
    // ToggleSwitch 버튼을 직접 클릭한 경우 무시 (ToggleSwitch가 자체적으로 toggle 호출)
    if ((e.target as HTMLElement).closest('button[role="switch"]')) {
      return;
    }
    toggle();
  };

  // 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      role="menuitem"
      tabIndex={0}
      className="flex w-full cursor-pointer items-center justify-between rounded-sm px-4 py-2.5 text-left text-sm text-white transition-colors duration-150 ease-in-out hover:bg-white/10 focus:ring-2 focus:ring-white/20 focus:outline-hidden motion-reduce:transition-none"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <span>전체 알림 설정</span>
      <ToggleSwitch checked={user.setAlarm} onChange={toggle} disabled={isLoading} />
    </div>
  );
}
