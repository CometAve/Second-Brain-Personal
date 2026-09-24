import { X, ChevronUp } from 'lucide-react';
import { ThemeToggle } from '@/content-scripts/overlay/components/atoms/ThemeToggle';
import { TooltipButton } from '@/content-scripts/overlay/components/atoms/TooltipButton';
import { UserAvatar } from '@/content-scripts/overlay/components/molecules/UserAvatar';
import type { UserInfo } from '@/types/auth';

/**
 * Toolbar (Molecule)
 * - 상단 툴바 영역
 * - Theme Toggle + User Avatar + Collapse + Close 버튼
 */
interface ToolbarProps {
  authenticated: boolean;
  user?: UserInfo | null;
  onCollapse: () => void;
  onClose: () => void;
  onLogout: () => void;
}

export function Toolbar({ authenticated, user, onCollapse, onClose, onLogout }: ToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-t-xl border-b border-border bg-card p-2">
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-1">
        {authenticated && user && <UserAvatar user={user} onLogout={onLogout} />}
        <TooltipButton
          icon={<ChevronUp className="size-4" />}
          tooltip="접기"
          onClick={onCollapse}
        />
        <TooltipButton icon={<X className="size-4" />} tooltip="닫기" onClick={onClose} />
      </div>
    </div>
  );
}
