import { useState } from 'react';

const AVATAR_SIZE_CLASSES = { sm: 'size-8', md: 'size-10', lg: 'size-12' };

/**
 * 사용자 프로필 아바타 컴포넌트
 * - 프로필 이미지 또는 폴백 아이콘 표시
 * - 이미지 로드 실패 시 자동 폴백
 * - 크기 조절 가능 (sm, md, lg)
 */

interface UserAvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  fallbackIcon: React.ReactNode;
}

export function UserAvatar({ src, alt, size = 'md', fallbackIcon }: UserAvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  // 이미지가 없거나 로드 실패 시 폴백 아이콘 표시
  if (!src || failedSource === src) {
    return (
      <div className={`${AVATAR_SIZE_CLASSES[size]} flex items-center justify-center`}>
        {fallbackIcon}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${AVATAR_SIZE_CLASSES[size]} rounded-full object-cover select-none`}
      draggable={false}
      onError={() => setFailedSource(src)}
    />
  );
}
