import { useExchangeToken } from '@/features/auth/hooks/useExchangeToken';
import { useCallbackHandler } from '@/features/auth/hooks/useCallbackHandler';
import { Route } from '@/routes/auth/callback';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';

/**
 * OAuth2 콜백 페이지
 * - URL에서 code 파라미터 추출
 * - code를 JWT 토큰으로 교환
 * - 사용자 정보 조회 후 대시보드로 이동
 * - 에러 발생 시 랜딩페이지로 이동
 */
export function CallbackPage() {
  const search = Route.useSearch();
  const { mutate: exchangeToken } = useExchangeToken();

  // 커스텀 훅으로 콜백 처리 로직 분리
  useCallbackHandler(search.code, search.error, (code) => {
    const epoch = useAuthStore.getState().beginSession();
    exchangeToken({ code, epoch });
  });

  return <LoadingSpinner />;
}
