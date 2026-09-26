import { type ReactNode } from 'react';
import { Library, Plus } from 'lucide-react';
import { BaseLayout } from '@/layouts/BaseLayout';
import { UserProfileButton } from '@/features/auth/components/UserProfileButton';
import { SearchBar } from '@/features/main/components/SearchBar';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { BrandLogo } from '@/shared/components/BrandLogo';

interface MainLayoutProps {
  children: ReactNode;
  onPlusClick?: () => void;
  isCreateDisabled?: boolean;
}

export function MainLayout({ children, onPlusClick, isCreateDisabled = false }: MainLayoutProps) {
  const openRecent = useSearchPanelStore((state) => state.openRecent);
  const closePanel = useSearchPanelStore((state) => state.closePanel);
  const isOpen = useSearchPanelStore((state) => state.isOpen);

  function handleMenuClick() {
    if (isOpen) closePanel();
    else {
      openRecent();
      requestAnimationFrame(() => document.getElementById('search-panel-close')?.focus());
    }
  }

  return (
    <BaseLayout>
      <main aria-label="지식 지도" className="absolute inset-x-0 top-18 bottom-0">
        {children}
      </main>
      <header className="absolute inset-x-0 top-0 z-50 flex h-18 items-center gap-2 border-b border-white/8 bg-background/95 px-3 sm:gap-4 sm:px-6">
        <div className="mr-2 hidden shrink-0 items-center gap-2.5 lg:flex">
          <BrandLogo className="h-10 w-14" />
          <span className="text-base font-semibold tracking-tight">Second Brain</span>
        </div>
        <button
          id="search-panel-toggle"
          type="button"
          onClick={handleMenuClick}
          className={`flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors motion-reduce:transition-none ${isOpen ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/6 hover:text-foreground'}`}
          aria-label={isOpen ? '검색 패널 닫기' : '검색 패널 열기'}
          aria-expanded={isOpen}
          aria-controls="search-panel"
          title="노트 목록"
        >
          <Library className="size-4.5" aria-hidden="true" />
          <span className="hidden sm:inline">노트</span>
        </button>
        <div className="mx-auto min-w-0 flex-1 lg:max-w-md">
          <SearchBar />
        </div>
        <button
          id="note-create-button"
          type="button"
          onClick={onPlusClick}
          disabled={isCreateDisabled}
          aria-label="새 노트 작성"
          title={
            isCreateDisabled ? '현재 초안을 닫은 뒤 새 노트를 작성할 수 있습니다' : '새 노트 작성'
          }
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50 sm:px-4"
        >
          <Plus className="size-4.5" aria-hidden="true" />
          <span className="hidden text-sm md:inline">새 노트</span>
        </button>
        <UserProfileButton />
      </header>
    </BaseLayout>
  );
}
