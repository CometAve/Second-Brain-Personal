import type { UserInfo } from '@/features/auth/types/auth';

/**
 * 사용자 프로필 표시 컴포넌트
 * - 순수 프레젠테이션 컴포넌트 (비즈니스 로직 없음)
 * - 프로필 이미지, 이름, 이메일 표시
 */

interface UserProfileProps {
  user: UserInfo;
}

export function UserProfile({ user }: UserProfileProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src={user.picture ?? undefined}
        alt={user.name}
        className="size-24 rounded-full"
        onError={(e) => {
          e.currentTarget.src = 'https://via.placeholder.com/96?text=User';
        }}
      />
      <div className="text-center">
        <h2 className="text-xl font-bold">{user.name}</h2>
        <p className="text-gray-600">{user.email}</p>
      </div>
    </div>
  );
}
