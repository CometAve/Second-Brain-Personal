import { createRootRoute } from '@tanstack/react-router';

import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { refreshToken } from '@/features/auth/services/authService';
import { getCurrentUser } from '@/features/auth/services/userService';
import { isAxiosErrorWithStatus } from '@/shared/utils/typeGuards';
import { RootLayout } from '@/layouts/RootLayout';

/**
 * 루트 레이아웃
 * - beforeLoad에서 세션 복원 대기
 * - 모든 자식 라우트의 공통 레이아웃
 * - Router context에 인증 상태 제공
 */
export const Route = createRootRoute({
  component: RootLayout,
  /**
   * beforeLoad에서 세션 복원 완료 대기 (비동기)
   * - ensureQueryData로 세션 복원 완료까지 대기
   * - 자식 라우트의 beforeLoad는 세션 복원 후 실행됨
   */
  beforeLoad: async () => {
    // 세션 복원 완료 대기 (캐시에 있으면 즉시 반환, 없으면 실행 후 대기)
    await queryClient.ensureQueryData({
      queryKey: ['session', 'restore'],
      queryFn: async () => {
        try {
          // 1. Refresh Token으로 새 Access Token 발급
          const response = await refreshToken();

          // response가 null이면 401 에러 (로그아웃 상태)
          if (!response) {
            return null;
          }

          if (response.success && response.data) {
            // 2. Access Token 저장
            useAuthStore.getState().setAccessToken(response.data.accessToken);

            // 3. 사용자 정보 조회
            const userInfo = await getCurrentUser();
            useAuthStore.getState().setUser(userInfo);

            return userInfo;
          }

          throw new Error('No active session');
        } catch {
          // 세션 복원 실패 (로그인 전 상태로 간주)
          return null;
        }
      },
      // 네트워크 오류 시 재시도 설정
      retry: (failureCount, error) => {
        if (isAxiosErrorWithStatus(error)) {
          const status = error.response.status;
          if (status === 401 || status === 403) {
            return false; // 인증 실패는 재시도 안 함
          }
        }
        return failureCount < 3; // 네트워크 오류는 3번까지 재시도
      },
      staleTime: Infinity,
    });

    // 세션 복원 완료 후 최신 인증 상태 반환
    const { isAuthenticated } = useAuthStore.getState();
    return {
      auth: {
        isAuthenticated,
      },
    };
  },
});
