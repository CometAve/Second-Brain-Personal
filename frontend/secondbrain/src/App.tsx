import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';

import { queryClient } from '@/lib/queryClient';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
// routeTree.gen.ts는 @ts-nocheck로 생성되어 타입 추론 불가

import { routeTree } from '@/routeTree.gen';

/**
 * TanStack Router 인스턴스 생성
 * - 자동 생성된 routeTree 사용
 */

const router = createRouter({
  routeTree,
  defaultPendingComponent: PendingApp,
  defaultPendingMs: 120,
  defaultPendingMinMs: 0,
});

function PendingApp() {
  // Router already applied its pending delay before mounting this component.
  return <LoadingSpinner delayMs={0} />;
}

/**
 * TypeScript 타입 추론을 위한 Router 타입 선언
 */
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/**
 * App 컴포넌트
 * - QueryClientProvider로 TanStack Query 설정
 * - RouterProvider로 TanStack Router 설정
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export { App };
