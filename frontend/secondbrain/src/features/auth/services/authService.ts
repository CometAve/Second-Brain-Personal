import { apiClient, isAxios401 } from '@/api/client';
import { parseTokenResponse } from '@/features/auth/schemas/authSchemas';
import type { TokenResponse } from '@/features/auth/types/auth';
import { parseSuccessEnvelope } from '@/shared/api/responseSchemas';

function parseVoid(data: unknown): void {
  if (data !== undefined && data !== null) throw new Error('Unexpected response data');
}

export async function exchangeToken(code: string, sessionEpoch: number): Promise<TokenResponse> {
  const response = await apiClient.post<unknown>('/api/auth/token', null, {
    params: { code },
    sessionEpoch,
  });
  return parseTokenResponse(response.data);
}

/** Only a 401 from this anonymous cookie endpoint means no restorable session. */
export async function refreshToken(
  sessionEpoch: number,
  signal?: AbortSignal,
): Promise<TokenResponse | null> {
  try {
    const response = await apiClient.post<unknown>('/api/auth/refresh', null, {
      sessionEpoch,
      signal,
    });
    return parseTokenResponse(response.data);
  } catch (error) {
    if (isAxios401(error)) return null;
    throw error;
  }
}

export async function logout(sessionEpoch: number): Promise<void> {
  const response = await apiClient.post<unknown>('/api/auth/logout', null, { sessionEpoch });
  parseSuccessEnvelope(response.data, parseVoid);
}
