import { z } from 'zod';
import { apiClient } from '@/api/client';
import { parseSuccessEnvelope } from '@/shared/api/responseSchemas';
import type {
  Note,
  RecentNote,
  SearchNoteData,
  SearchNoteRequest,
  SimilarNoteRequest,
} from '@/features/main/types/search';

const SEARCH_ENDPOINT = '/api/notes';
const NOTE_SCHEMA = z.object({
  id: z.int().positive(),
  title: z.string(),
  content: z.string(),
  userId: z.int().positive(),
  createdAt: z.iso.datetime({ local: true, offset: true }),
  updatedAt: z.iso.datetime({ local: true, offset: true }),
  remindCount: z.int().nonnegative(),
});
const RECENT_NOTES_SCHEMA = z.array(z.object({ noteId: z.int().positive(), title: z.string() }));
const SEARCH_DATA_SCHEMA = z.object({
  results: z.array(NOTE_SCHEMA),
  totalCount: z.int().nonnegative(),
  currentPage: z.int().nonnegative(),
  totalPages: z.int().nonnegative(),
  pageSize: z.int().positive(),
});

export function parseRecentNotes(input: unknown): RecentNote[] {
  return parseSuccessEnvelope(input, (data) => {
    // This endpoint deliberately omits data for an empty recent-note list.
    return data == null ? [] : RECENT_NOTES_SCHEMA.parse(data);
  });
}

export function parseSearchNotes(input: unknown): SearchNoteData {
  return parseSuccessEnvelope(input, (data) => SEARCH_DATA_SCHEMA.parse(data));
}

export const searchAPI = {
  async getSimilarNote(
    requestData: SimilarNoteRequest,
    sessionEpoch: number,
    signal?: AbortSignal,
  ): Promise<Note[]> {
    const noteId = z.int().positive().parse(requestData.noteId);
    const limit = z.int().positive().parse(requestData.limit);
    const response = await apiClient.get<unknown>(`${SEARCH_ENDPOINT}/${noteId}/similar`, {
      params: { limit },
      sessionEpoch,
      signal,
    });
    return parseSuccessEnvelope(response.data, (data) => z.array(NOTE_SCHEMA).parse(data));
  },

  async getSearchNote(
    requestData: SearchNoteRequest,
    sessionEpoch: number,
    signal?: AbortSignal,
  ): Promise<SearchNoteData> {
    const response = await apiClient.get<unknown>(`${SEARCH_ENDPOINT}/search`, {
      params: requestData,
      sessionEpoch,
      signal,
    });
    return parseSearchNotes(response.data);
  },

  async getRecentNote(sessionEpoch: number, signal?: AbortSignal): Promise<RecentNote[]> {
    const response = await apiClient.get<unknown>(`${SEARCH_ENDPOINT}/recent`, {
      sessionEpoch,
      signal,
    });
    return parseRecentNotes(response.data);
  },
};
