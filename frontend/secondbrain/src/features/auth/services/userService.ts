import { apiClient } from '@/api/client';
import { parseUserResponse } from '@/features/auth/schemas/authSchemas';
import type { UserInfo } from '@/features/auth/types/auth';

/** GET /api/users/me returns UserResponse directly, without a BaseResponse envelope. */
export async function getCurrentUser(
  sessionEpoch: number,
  signal?: AbortSignal,
  accessToken?: string,
): Promise<UserInfo> {
  const response = await apiClient.get<unknown>('/api/users/me', {
    sessionEpoch,
    signal,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  return parseUserResponse(response.data);
}
