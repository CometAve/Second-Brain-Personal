import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { LogoutButton } from '@/features/auth/components/LogoutButton';
import { ApiKeyMenuItem } from '@/features/auth/components/ApiKeyMenuItem';
import { ApiKeyManagement } from '@/features/auth/components/ApiKeyManagement';
import { Dropdown } from '@/shared/components/Dropdown/Dropdown';
import LogoutIcon from '@/shared/components/icon/Logout.svg?react';
import type { UserProfileView } from '@/features/auth/types/apiKey';

/**
 * 사용자 프로필 드롭다운 메뉴
 * - 사용자 정보 표시
 * - MCP API Key 관리 (발급/삭제/복사)
 * - 로그아웃 버튼 포함
 * - GlassElement 기반 스타일
 * - Dropdown 컴포넌트 사용
 * - 뷰 전환: 메뉴 ↔ API Key 관리
 *
 * TODO: 향후 기능 추가 예정
 * - 전체 알림 설정
 * - 리마인더 관리
 */

interface UserProfileMenuProps {
  isOpen: boolean;
  view: UserProfileView;
  onViewChange: (view: UserProfileView) => void;
  onClose: () => void;
}

export function UserProfileMenu({ isOpen, view, onViewChange, onClose }: UserProfileMenuProps) {
  const { user } = useAuthStore();
  const previousViewRef = useRef<UserProfileView>(view);
  const apiKeyMenuRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen || previousViewRef.current === view) return;
    previousViewRef.current = view;
    if (view === 'apikey-management') backButtonRef.current?.focus();
    else apiKeyMenuRef.current?.focus();
  }, [isOpen, view]);

  if (!user) return null;

  return (
    <Dropdown isOpen={isOpen} onClose={onClose} position="bottom-right">
      <div
        className={`max-h-[calc(100dvh-6rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border border-white/10 bg-card shadow-[0_12px_48px_#0008] transition-[width] duration-150 motion-reduce:transition-none ${
          view === 'menu' ? 'w-72' : 'w-108'
        }`}
      >
        {view === 'menu' ? (
          // 메뉴 상태
          <div role="menu" className="flex w-full flex-col gap-1 p-2">
            {/* 사용자 정보 */}
            <div className="p-3">
              <p className="text-sm font-medium wrap-anywhere text-white">{user.name}</p>
              <p className="mt-1 text-xs wrap-anywhere text-muted-foreground">{user.email}</p>
            </div>

            {/* 구분선 */}
            <hr className="my-1 border-white/8" />

            {/* API Key 메뉴 아이템 */}
            <ApiKeyMenuItem
              buttonRef={apiKeyMenuRef}
              onClick={() => onViewChange('apikey-management')}
            />

            {/* TODO: 향후 리마인더 기능 추가 예정 - ReminderToggleMenuItem, 리마인더 관리 메뉴 */}

            <hr className="my-1 border-white/8" />

            {/* 로그아웃 버튼 */}
            <LogoutButton
              variant="menu-item"
              size="sm"
              icon={<LogoutIcon className="size-5" />}
              onLogoutStart={onClose}
            />
          </div>
        ) : (
          // API Key 관리 상태
          <div className="flex w-full flex-col gap-3 p-4">
            {/* 뒤로 가기 버튼 */}
            <button
              ref={backButtonRef}
              onClick={(e) => {
                // 이벤트 버블링 차단 - Dropdown의 외부 클릭 감지와 충돌 방지
                e.stopPropagation();
                onViewChange('menu');
              }}
              className="flex items-center gap-2 self-start rounded-sm px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              <span>뒤로</span>
            </button>

            {/* API Key 관리 UI */}
            <ApiKeyManagement />
          </div>
        )}
      </div>
    </Dropdown>
  );
}
