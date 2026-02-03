import type { AxiosError } from 'axios';

/**
 * Axios 에러 타입 가드
 * - unknown 타입의 에러가 AxiosError인지 검증
 * - response 속성 존재 여부 확인
 */
export function isAxiosError(error: unknown): error is AxiosError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

/**
 * HTTP 상태 코드가 있는 Axios 에러 타입 가드
 * - isAxiosError를 확장하여 response.status 존재 보장
 */
export function isAxiosErrorWithStatus(
  error: unknown,
): error is AxiosError & { response: { status: number } } {
  return (
    isAxiosError(error) && error.response !== undefined && typeof error.response.status === 'number'
  );
}

/**
 * 특정 HTTP 상태 코드 에러인지 확인
 * @param error - 검증할 에러
 * @param status - 확인할 HTTP 상태 코드
 */
export function isHttpError(error: unknown, status: number): boolean {
  return isAxiosErrorWithStatus(error) && error.response.status === status;
}

/**
 * 401 Unauthorized 에러 확인
 */
export function isUnauthorizedError(error: unknown): boolean {
  return isHttpError(error, 401);
}

/**
 * 409 Conflict 에러 확인
 */
export function isConflictError(error: unknown): boolean {
  return isHttpError(error, 409);
}

/**
 * 404 Not Found 에러 확인
 */
export function isNotFoundError(error: unknown): boolean {
  return isHttpError(error, 404);
}
