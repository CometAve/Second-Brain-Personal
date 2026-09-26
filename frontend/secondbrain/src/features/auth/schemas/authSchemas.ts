import { z } from 'zod';

import { InvalidApiResponseError, parseSuccessEnvelope } from '@/shared/api/responseSchemas';
import type { TokenResponse, UserInfo } from '@/features/auth/types/auth';

const TOKEN_SCHEMA = z.object({
  accessToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});

const USER_SCHEMA = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  name: z.string(),
  picture: z.string().nullable(),
  setAlarm: z.boolean(),
});

export function parseTokenResponse(input: unknown): TokenResponse {
  return parseSuccessEnvelope(input, (data) => {
    const result = TOKEN_SCHEMA.safeParse(data);
    if (!result.success) throw new InvalidApiResponseError();
    return result.data;
  });
}

export function parseUserResponse(input: unknown): UserInfo {
  const result = USER_SCHEMA.safeParse(input);
  if (!result.success) throw new InvalidApiResponseError();
  return result.data;
}
