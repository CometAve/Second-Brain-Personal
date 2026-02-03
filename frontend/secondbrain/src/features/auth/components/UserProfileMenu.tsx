import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { GlassElement } from '@/shared/components/GlassElement/GlassElement';
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
  onClose: () => void;
}

export function UserProfileMenu({ isOpen, onClose }: UserProfileMenuProps) {
  const { user } = useAuthStore();
  const [view, setView] = useState<UserProfileView>('menu');

  if (!user) return null;

  return (
    <Dropdown isOpen={isOpen} onClose={onClose} position="bottom-right">
      <GlassElement
        as="div"
        className={`overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none ${
          view === 'menu' ? 'w-[320px]' : 'w-[480px]'
        }`}
      >
        {view === 'menu' ? (
          // 메뉴 상태
          <div role="menu" className="w-full space-y-1 p-2">
            {/* 사용자 정보 */}
            <div className="px-4 py-2">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="text-xs text-white/70">{user.email}</p>
            </div>

            {/* 구분선 */}
            <hr className="border-white/20" />

            {/* API Key 메뉴 아이템 */}
            <ApiKeyMenuItem onClick={() => setView('apikey-management')} />

            {/* TODO: 향후 리마인더 기능 추가 예정 - ReminderToggleMenuItem, 리마인더 관리 메뉴 */}

            <hr className="border-white/20" />

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
          <div className="w-full space-y-3 p-4">
            {/* 뒤로 가기 버튼 */}
            <button
              onClick={(e) => {
                // 이벤트 버블링 차단 - Dropdown의 외부 클릭 감지와 충돌 방지
                e.stopPropagation();
                setView('menu');
              }}
              className="flex items-center gap-2 rounded px-2 py-1 text-sm text-white/80 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
            >
              <ArrowLeft className="size-4" />
              <span>뒤로</span>
            </button>

            {/* API Key 관리 UI */}
            <ApiKeyManagement />
          </div>
        )}
      </GlassElement>
    </Dropdown>
  );
}
