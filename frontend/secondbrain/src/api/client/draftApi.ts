import { z } from 'zod';
import { apiClient } from '@/api/client';
import { parseSuccessEnvelope } from '@/shared/api/responseSchemas';
import { captureSessionEpoch } from '@/stores/authStore';
import type {
  NoteDraftRequest,
  NoteDraftResponse,
  NoteDraftListResponse,
} from '@/shared/types/draft.types';
import type { NoteResponse } from '@/shared/types/note.types';
import { parseNoteResponse } from '@/api/client/noteApi';

const API_BASE_URL = '/api/drafts';

const DRAFT_SCHEMA = z.object({
  noteId: z.string().min(1),
  title: z
    .string()
    .nullable()
    .transform((value) => value ?? ''),
  content: z
    .string()
    .nullable()
    .transform((value) => value ?? ''),
  version: z.number().int().positive(),
  lastModified: z.string().min(1),
});
const DRAFT_LIST_SCHEMA = z.object({
  drafts: z.array(DRAFT_SCHEMA),
  totalCount: z.number().int().nonnegative(),
});

export interface DraftRequestOptions {
  sessionEpoch?: number;
  signal?: AbortSignal;
}

export const draftQueries = {
  all: ['drafts'] as const,
  lists: () => [...draftQueries.all, 'list'] as const,
  list: () => [...draftQueries.lists()] as const,
  details: () => [...draftQueries.all, 'detail'] as const,
  detail: (id: string, sessionEpoch?: number) =>
    [...draftQueries.details(), id, sessionEpoch] as const,
};

export async function saveDraft(
  data: NoteDraftRequest,
  options: DraftRequestOptions = {},
): Promise<NoteDraftResponse> {
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.post<unknown>(API_BASE_URL, data, {
    sessionEpoch,
    signal: options.signal,
  });
  return parseSuccessEnvelope(response.data, (payload) => DRAFT_SCHEMA.parse(payload));
}

export async function getDraft(
  noteId: string,
  options: DraftRequestOptions = {},
): Promise<NoteDraftResponse> {
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.get<unknown>(`${API_BASE_URL}/${noteId}`, {
    sessionEpoch,
    signal: options.signal,
  });
  return parseSuccessEnvelope(response.data, (payload) => DRAFT_SCHEMA.parse(payload));
}

export async function listDrafts(
  options: DraftRequestOptions = {},
): Promise<NoteDraftListResponse> {
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.get<unknown>(API_BASE_URL, {
    sessionEpoch,
    signal: options.signal,
  });
  return parseSuccessEnvelope(response.data, (payload) => DRAFT_LIST_SCHEMA.parse(payload));
}

export async function deleteDraft(
  noteId: string,
  options: DraftRequestOptions = {},
): Promise<void> {
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.delete<unknown>(`${API_BASE_URL}/${noteId}`, {
    sessionEpoch,
    signal: options.signal,
  });
  parseSuccessEnvelope(response.data, () => undefined);
}

export async function saveToDatabase(
  noteId: string,
  options: DraftRequestOptions = {},
): Promise<NoteResponse> {
  const sessionEpoch = options.sessionEpoch ?? captureSessionEpoch();
  const response = await apiClient.post<unknown>(`/api/notes/from-draft/${noteId}`, undefined, {
    sessionEpoch,
    signal: options.signal,
  });
  return parseSuccessEnvelope(response.data, parseNoteResponse);
}
