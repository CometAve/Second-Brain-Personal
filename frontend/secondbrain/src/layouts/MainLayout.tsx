import { type ReactNode } from 'react';
import { BaseLayout } from '@/layouts/BaseLayout';
import { GlassElement } from '@/shared/components/GlassElement/GlassElement';
import { UserProfileButton } from '@/features/auth/components/UserProfileButton';
import { SearchBar } from '@/features/main/components/SearchBar';
import PlusIcon from '@/shared/components/icon/Plus.svg?react';
import MenuIcon from '@/shared/components/icon/menu.svg?react';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';

interface MainLayoutProps {
  children: ReactNode;
  onPlusClick?: () => void;
}

const MainLayout = ({ children, onPlusClick }: MainLayoutProps) => {
  const openRecent = useSearchPanelStore((state) => state.openRecent);
  const closePanel = useSearchPanelStore((state) => state.closePanel);
  const isOpen = useSearchPanelStore((state) => state.isOpen);

  // 햄버거 메뉴 클릭 핸들러: 패널 토글
  const handleMenuClick = () => {
    if (isOpen) {
      closePanel();
    } else {
      openRecent();
    }
  };

  return (
    <BaseLayout>
      {/* 배경 레이어: children (Graph 등) */}
      <div className="relative size-full">{children}</div>

      {/* UI 레이어: 개별 요소만 z-index로 위에 배치 */}
      {/* 햄버거 메뉴 버튼 - 패널이 닫혀있을 때만 표시 */}
      <button
        onClick={handleMenuClick}
        className={`absolute top-10 left-10 z-50 rounded-lg p-2 text-white/80 transition-all duration-200 ease-out hover:scale-110 hover:bg-white/10 hover:text-white motion-reduce:transition-none ${
          isOpen ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'
        }`}
        aria-label={isOpen ? '검색 패널 닫기' : '검색 패널 열기'}
      >
        <MenuIcon className="size-6" />
      </button>

      {/* 검색창 */}
      <div className="absolute top-10 left-1/2 z-50 -translate-x-1/2">
        <SearchBar />
      </div>

      <div className="absolute top-10 right-10 z-50">
        <UserProfileButton />
      </div>

      <div className="absolute right-10 bottom-10 z-50">
        <GlassElement
          as="button"
          icon={<PlusIcon />}
          onClick={onPlusClick}
          aria-label="새 노트 작성"
        />
      </div>
    </BaseLayout>
  );
};

export { MainLayout };
