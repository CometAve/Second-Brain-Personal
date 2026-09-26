import { z } from 'zod';

const SUCCESS_ENVELOPE_SCHEMA = z.object({
  success: z.boolean(),
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

export class InvalidApiResponseError extends Error {
  constructor() {
    super('Invalid API response');
    this.name = 'InvalidApiResponseError';
  }
}

export class ApiResponseError extends Error {
  readonly code: number;

  constructor(code: number) {
    super('API request failed');
    this.name = 'ApiResponseError';
    this.code = code;
  }
}

/** The endpoint owns its payload schema, including any explicitly valid missing data. */
export function parseSuccessEnvelope<Data>(
  input: unknown,
  parseData: (data: unknown) => Data,
): Data {
  const envelope = SUCCESS_ENVELOPE_SCHEMA.safeParse(input);
  if (!envelope.success) throw new InvalidApiResponseError();
  if (!envelope.data.success) throw new ApiResponseError(envelope.data.code);
  try {
    return parseData(envelope.data.data);
  } catch {
    throw new InvalidApiResponseError();
  }
}
