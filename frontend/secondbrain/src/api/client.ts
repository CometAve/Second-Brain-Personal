import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import type { BaseResponse } from '@/shared/types/api';
import { useAuthStore } from '@/stores/authStore';
import { env } from '@/config/env';

/**
 * Axios 요청 설정 확장 인터페이스
 * - _retry: 토큰 갱신 후 재시도 여부 추적
 */
interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/**
 * BaseResponse 타입 가드 함수
 * - 응답 데이터가 BaseResponse 구조인지 검증
 * - TypeScript 타입 내로잉(narrowing) 지원
 */
function isBaseResponse<Data>(data: unknown): data is BaseResponse<Data> {
  return data !== null && typeof data === 'object' && 'success' in data && 'data' in data;
}

/**
 * Axios 인스턴스 생성
 * - baseURL: 환경 변수에서 타입 안전하게 가져옴
 * - withCredentials: true (쿠키 전송 허용)
 * - timeout: 10초
 */
const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
});

/**
 * Request Interceptor
 * - Access Token을 자동으로 헤더에 추가
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

/**
 * API Client 생성 함수 (클로저 패턴)
 * - refreshTokenPromise를 클로저로 캡슐화
 * - 여러 API 클라이언트 인스턴스 사용 시에도 안전
 */
const createApiClient = () => {
  /**
   * Refresh Token Promise 캐싱 (클로저 변수)
   * - 동시 다발적 401 발생 시 refresh API 중복 호출 방지
   * - 첫 번째 refresh 요청만 실행하고 나머지는 Promise를 재사용
   */
  let refreshTokenPromise: Promise<string> | null = null;

  /**
   * Response Interceptor
   * - BaseResponse 구조 처리
   * - 401 에러 시 Token Refresh 시도 (Promise 캐싱으로 중복 호출 방지)
   */
  apiClient.interceptors.response.use(
    (response) => {
      // Axios 인터셉터는 response 객체를 반환해야 함
      // 타입 가드 함수를 사용하여 BaseResponse 구조 검증
      if (isBaseResponse(response.data)) {
        // BaseResponse 구조인 경우 그대로 유지
        return response;
      }

      // GET /api/users/me는 BaseResponse 없이 직접 반환
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as ExtendedAxiosRequestConfig;

      // /api/auth/refresh 자체의 401은 무시 (무한 루프 방지)
      if (originalRequest.url?.includes('/api/auth/refresh')) {
        return Promise.reject(error);
      }

      // 401 에러 시 Token Refresh 시도
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // 이미 진행 중인 refresh 요청이 있으면 재사용 (중복 호출 방지)
          if (!refreshTokenPromise) {
            refreshTokenPromise = apiClient
              .post<BaseResponse<{ accessToken: string; tokenType: string; expiresIn: number }>>(
                '/api/auth/refresh',
              )
              .then((response) => {
                const baseResponse = response.data;
                if (baseResponse.success && baseResponse.data) {
                  const { accessToken } = baseResponse.data;
                  useAuthStore.getState().setAccessToken(accessToken);
                  return accessToken;
                }
                throw new Error('Invalid refresh response');
              })
              .finally(() => {
                // 완료 후 Promise 캐시 초기화
                refreshTokenPromise = null;
              });
          }

          // refresh 완료 대기
          const accessToken = await refreshTokenPromise;

          // 원래 요청에 새 토큰 설정
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          // 원래 요청 재시도
          return apiClient.request(originalRequest);
        } catch {
          // Refresh 실패 시 로그아웃 처리
          useAuthStore.getState().clearAuth();
          window.location.href = '/';
          return Promise.reject(new Error('Token refresh failed'));
        }
      }

      return Promise.reject(error);
    },
  );

  return apiClient;
};

// API Client 인스턴스 생성 및 초기화
createApiClient();

// fast api용 client
export const fastApiClient = axios.create({
  baseURL: `${env.apiBaseUrl}/ai/api/v1`,
  timeout: 20000, // AI API는 타임아웃을 더 길게 설정
});

/**
 * FastAPI Request Interceptor
 * - X-User-ID 헤더를 자동으로 추가
 * - 인증 토큰 없이 사용자 ID만 전송
 */
fastApiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const userId = useAuthStore.getState().user?.id;
    if (userId) {
      config.headers['X-User-ID'] = userId.toString();
    } else {
      // 개발 환경에서 사용자가 없을 경우 demo-user 사용
      config.headers['X-User-ID'] = 'demo-user';
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

export { apiClient };
