import { useNavigate } from '@tanstack/react-router';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { Route } from '@/routes/main';
import { MainLayout } from '@/layouts/MainLayout';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { SearchPanel } from '@/features/main/components/SearchPanel';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary';
import { DraftEditor } from '@/features/note/components/DraftEditor';
import { GraphPanel } from '@/features/main/components/GraphPanel';

/**
 * 메인 페이지
 * - 로딩 및 에러 상태 처리
 * - 인증 체크는 라우트 레벨(main.tsx)에서 beforeLoad로 처리
 * - Search Params 기반 Side Peek (Draft/Note)
 */
export function MainPage() {
  const { data: user, isLoading, isError, refetch } = useCurrentUser();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const activeDraftId = search.draft;
  const isOpen = useSearchPanelStore((state) => state.isOpen);

  // PlusIcon 클릭: Draft 생성
  const handleCreateDraft = () => {
    if (search.draft) return;
    const draftId = crypto.randomUUID();
    void navigate({ search: { draft: draftId } });
  };

  // The editor calls this only after its close/save policy has finished.
  const handleCloseSidePeek = (draftId: string) => {
    void navigate({
      search: (previous) =>
        previous.draft === draftId ? { ...previous, draft: undefined } : previous,
      replace: true,
    });
  };

  if (isLoading) {
    return (
      <MainLayout onPlusClick={handleCreateDraft} isCreateDisabled={!!search.draft}>
        <LoadingSpinner fullScreen={false} className="h-full" />
      </MainLayout>
    );
  }

  if (isError || !user) {
    return (
      <MainLayout onPlusClick={handleCreateDraft} isCreateDisabled={!!search.draft}>
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <p>사용자 정보를 불러올 수 없습니다.</p>
          <button type="button" onClick={() => void refetch()} className="underline">
            다시 시도
          </button>
        </div>
      </MainLayout>
    );
  }

  return (
    <div>
      <MainLayout onPlusClick={handleCreateDraft} isCreateDisabled={!!search.draft}>
        {/* 배경: Graph (lazy loaded - three.js 번들 분리) */}
        <ErrorBoundary>
          <GraphPanel />
        </ErrorBoundary>

        {activeDraftId && (
          <ErrorBoundary>
            <DraftEditor
              draftId={activeDraftId}
              isOpen
              onClose={() => handleCloseSidePeek(activeDraftId)}
            />
          </ErrorBoundary>
        )}
      </MainLayout>
      <div
        id="search-panel"
        inert={!isOpen}
        className={`absolute inset-x-3 top-21 bottom-3 z-40 transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none sm:top-23 sm:right-auto sm:bottom-5 sm:left-5 sm:w-88 ${
          isOpen
            ? 'pointer-events-auto translate-x-0 opacity-100'
            : 'pointer-events-none -translate-x-full opacity-0'
        }`}
      >
        <SearchPanel />
      </div>
    </div>
  );
}
