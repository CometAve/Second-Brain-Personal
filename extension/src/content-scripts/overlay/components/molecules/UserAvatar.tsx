import { LogOut } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/content-scripts/overlay/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/content-scripts/overlay/components/ui/dropdown-menu';
import type { UserInfo } from '@/types/auth';

/**
 * User Avatar (Molecule)
 * - 사용자 프로필 이미지
 * - 클릭 시 드롭다운 메뉴 (로그아웃)
 */
interface UserAvatarProps {
  user: UserInfo;
  onLogout: () => void;
}

export function UserAvatar({ user, onLogout }: UserAvatarProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center justify-center rounded-full p-0 transition-opacity hover:opacity-80">
          <Avatar className="size-8">
            <AvatarImage src={user.picture} alt={user.name} />
            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onClick={onLogout}
        >
          <LogOut className="size-4" />
          <span>로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
