import { apiClient } from '@/api/client';
import type { BaseResponse } from '@/shared/types/api';
import type { TokenResponse } from '@/features/auth/types/auth';
import { isUnauthorizedError } from '@/shared/utils/typeGuards';

/**
 * POST /api/auth/token
 * Authorization Code를 JWT 토큰으로 교환
 * @param code - OAuth2 Authorization Code
 * @returns BaseResponse<TokenResponse>
 */
export async function exchangeToken(code: string): Promise<BaseResponse<TokenResponse>> {
  // 백엔드는 @RequestParam으로 쿼리 파라미터를 기대함
  const response = await apiClient.post<BaseResponse<TokenResponse>>('/api/auth/token', null, {
    params: { code },
  });
  return response.data;
}

/**
 * POST /api/auth/refresh
 * Refresh Token으로 새 Access Token 발급
 * @returns BaseResponse<TokenResponse> 또는 null (401 에러 시)
 */
export async function refreshToken(): Promise<BaseResponse<TokenResponse> | null> {
  try {
    const response = await apiClient.post<BaseResponse<TokenResponse>>('/api/auth/refresh');
    return response.data;
  } catch (error) {
    // 401 Unauthorized는 로그아웃 상태로 처리 (에러를 throw하지 않음)
    if (isUnauthorizedError(error)) {
      console.info('Refresh token expired or invalid - user needs to re-authenticate');
      return null;
    }
    // 다른 에러는 그대로 throw
    throw error;
  }
}

/**
 * POST /api/auth/logout
 * 로그아웃 처리 (Refresh Token 무효화)
 * @returns BaseResponse<null>
 */
export async function logout(): Promise<BaseResponse<null>> {
  const response = await apiClient.post<BaseResponse<null>>('/api/auth/logout');
  return response.data;
}
