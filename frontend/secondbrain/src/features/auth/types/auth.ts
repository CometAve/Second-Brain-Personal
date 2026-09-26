/**
 * Token 응답 데이터 (BaseResponse의 data 필드)
 * POST /api/auth/token, POST /api/auth/refresh에서 반환
 */
export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

/**
 * 사용자 정보
 * GET /api/users/me는 BaseResponse 없이 이 타입을 직접 반환
 */
export interface UserInfo {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  setAlarm: boolean;
}

/**
 * 로그인 자격 증명
 * Authorization Code를 JWT 토큰으로 교환할 때 사용
 */
export interface LoginCredentials {
  code: string;
}
