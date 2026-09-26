/**
 * 백엔드 공통 응답 형식
 * 대부분의 API가 이 구조를 사용함
 * 예외: GET /api/users/me는 BaseResponse 없이 직접 반환
 */
export interface BaseResponse<Data> {
  success: boolean;
  code: number;
  message: string;
  data?: Data | null;
}
