import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { UserAvatar } from '@/features/auth/components/UserAvatar';
import { UserProfileMenu } from '@/features/auth/components/UserProfileMenu';
import type { UserProfileView } from '@/features/auth/types/apiKey';

export function UserProfileButton() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState<UserProfileView>('menu');
  const user = useAuthStore((state) => state.user);

  function closeMenu() {
    setView('menu');
    setIsMenuOpen(false);
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className={`flex size-10 items-center justify-center overflow-hidden rounded-full border transition-colors ${isMenuOpen ? 'border-primary bg-primary/15 text-primary' : 'border-white/15 bg-white/5 text-muted-foreground hover:border-white/30 hover:text-foreground'}`}
        onClick={() => {
          if (isMenuOpen) closeMenu();
          else setIsMenuOpen(true);
        }}
        aria-label="사용자 프로필 메뉴"
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <UserAvatar
          src={user?.picture}
          alt={user?.name || '사용자'}
          size="sm"
          fallbackIcon={<UserRound className="size-5" aria-hidden="true" />}
        />
      </button>
      <UserProfileMenu isOpen={isMenuOpen} view={view} onViewChange={setView} onClose={closeMenu} />
    </div>
  );
}
