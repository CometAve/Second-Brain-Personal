import { z } from 'zod';

import { apiClient } from '@/api/client';
import { InvalidApiResponseError, parseSuccessEnvelope } from '@/shared/api/responseSchemas';

const API_KEY_SCHEMA = z.object({ apiKey: z.uuid() });

export async function generateApiKey(sessionEpoch: number): Promise<string> {
  const response = await apiClient.post<unknown>('/api/apikey', null, { sessionEpoch });
  return parseSuccessEnvelope(response.data, (data) => {
    const result = API_KEY_SCHEMA.safeParse(data);
    if (!result.success) throw new InvalidApiResponseError();
    return result.data.apiKey;
  });
}

export async function deleteApiKey(sessionEpoch: number): Promise<void> {
  const response = await apiClient.delete<unknown>('/api/apikey', { sessionEpoch });
  parseSuccessEnvelope(response.data, (data) => {
    if (data !== undefined && data !== null) throw new InvalidApiResponseError();
  });
}
