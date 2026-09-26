import { apiClient } from '@/api/client';
import { InvalidApiResponseError, parseSuccessEnvelope } from '@/shared/api/responseSchemas';

/** POST /api/users/reminders toggles the server-side setting. */
export async function toggleReminder(sessionEpoch: number): Promise<void> {
  const response = await apiClient.post<unknown>('/api/users/reminders', null, { sessionEpoch });
  parseSuccessEnvelope(response.data, (data) => {
    if (data !== undefined && data !== null) throw new InvalidApiResponseError();
  });
}
