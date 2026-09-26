import { z } from 'zod';
import { apiClient } from '@/api/client';
import { parseSuccessEnvelope } from '@/shared/api/responseSchemas';
import { captureSessionEpoch } from '@/stores/authStore';
import type { NoteRequest, NoteResponse } from '@/shared/types/note.types';

const API_BASE_URL = '/api/notes';

const NOTE_RESPONSE_SCHEMA = z.object({
  noteId: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  remindAt: z.string().nullable(),
  remindCount: z.number().int().nonnegative(),
});

export interface NoteRequestOptions {
  sessionEpoch?: number;
  signal?: AbortSignal;
}

export function parseNoteResponse(input: unknown): NoteResponse {
  return NOTE_RESPONSE_SCHEMA.parse(input);
}

export const noteQueries = {
  all: ['notes'] as const,
  lists: () => [...noteQueries.all, 'list'] as const,
  list: (filters?: string) => [...noteQueries.lists(), { filters }] as const,
  details: () => [...noteQueries.all, 'detail'] as const,
  detail: (id: number) => [...noteQueries.details(), id] as const,
};

export async function createNote(
  data: NoteRequest,
  options: NoteRequestOptions = {},
): Promise<void> {
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.post<unknown>(API_BASE_URL, data, {
    sessionEpoch,
    signal: options.signal,
  });
  parseSuccessEnvelope(response.data, () => undefined);
}

export async function getNote(id: number, options: NoteRequestOptions = {}): Promise<NoteResponse> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('Invalid note ID');
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.get<unknown>(`${API_BASE_URL}/${id}`, {
    sessionEpoch,
    signal: options.signal,
  });
  return parseSuccessEnvelope(response.data, parseNoteResponse);
}

export async function updateNote(
  id: number,
  data: NoteRequest,
  options: NoteRequestOptions = {},
): Promise<NoteResponse> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('Invalid note ID');
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.put<unknown>(`${API_BASE_URL}/${id}`, data, {
    sessionEpoch,
    signal: options.signal,
  });
  return parseSuccessEnvelope(response.data, parseNoteResponse);
}

export async function deleteNotes(
  noteIds: number[],
  options: NoteRequestOptions = {},
): Promise<void> {
  if (noteIds.length === 0 || noteIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new RangeError('Invalid note IDs');
  }
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.delete<unknown>(API_BASE_URL, {
    data: { noteIds },
    sessionEpoch,
    signal: options.signal,
  });
  parseSuccessEnvelope(response.data, () => undefined);
}
