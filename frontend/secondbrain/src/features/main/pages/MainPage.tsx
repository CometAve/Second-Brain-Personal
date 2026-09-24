import { useRef, lazy, Suspense } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { Route } from '@/routes/main';
import { MainLayout } from '@/layouts/MainLayout';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { SearchPanel } from '@/features/main/components/SearchPanel';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary';

// 무거운 컴포넌트 lazy loading (three.js, Milkdown 번들 분리)
const Graph = lazy(() =>
  import('@/features/main/components/Graph').then((m) => ({ default: m.Graph })),
);
const DraftEditor = lazy(() =>
  import('@/features/note/components/DraftEditor').then((m) => ({ default: m.DraftEditor })),
);

/**
 * 메인 페이지
 * - 로딩 및 에러 상태 처리
 * - 인증 체크는 라우트 레벨(main.tsx)에서 beforeLoad로 처리
 * - Search Params 기반 Side Peek (Draft/Note)
 */
export function MainPage() {
  const { data: user, isLoading, isError } = useCurrentUser();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const isOpen = useSearchPanelStore((state) => state.isOpen);

  // 마지막 유효한 draftId 저장 (애니메이션을 위해 DOM 유지)
  const lastDraftIdRef = useRef<string>('');
  if (search.draft) {
    lastDraftIdRef.current = search.draft;
  }

  // PlusIcon 클릭: Draft 생성
  const handleCreateDraft = () => {
    const draftId = crypto.randomUUID();
    void navigate({ search: { draft: draftId } });
  };

  // Side Peek 닫기
  const handleCloseSidePeek = () => {
    void navigate({ search: {} });
  };

  if (isLoading) {
    return (
      <MainLayout onPlusClick={handleCreateDraft}>
        <LoadingSpinner />
      </MainLayout>
    );
  }

  if (isError || !user) {
    return (
      <MainLayout onPlusClick={handleCreateDraft}>
        <div className="flex min-h-dvh items-center justify-center">
          <p>사용자 정보를 불러올 수 없습니다.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <div>
      <MainLayout onPlusClick={handleCreateDraft}>
        {/* 배경: Graph (lazy loaded - three.js 번들 분리) */}
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <Graph />
          </Suspense>
        </ErrorBoundary>

        {/* Side Peek: Draft - 애니메이션을 위해 항상 렌더링 (lazy loaded - Milkdown 번들 분리) */}
        <ErrorBoundary>
          <Suspense fallback={null}>
            <DraftEditor
              draftId={lastDraftIdRef.current || 'temp'}
              isOpen={!!search.draft}
              onClose={handleCloseSidePeek}
            />
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
      <div
        className={`absolute top-10 left-10 z-40 h-[calc(100%-5rem)] w-[27%] bg-transparent transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none ${
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
