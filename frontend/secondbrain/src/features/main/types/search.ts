// 유사 노트 검색
export interface Note {
  id: number;
  title: string;
  content: string;
  userId: number;
  createdAt: string;
  updatedAt: string;
  remindCount: number;
}

export interface SimilarNoteRequest {
  noteId: number;
  limit: number;
}

// 키워드 노트 검색
export interface SearchNoteRequest {
  keyword: string;
  page: number;
  size: number;
}

export interface SearchNoteData {
  results: Note[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

// 최근 작성 노트
export interface RecentNote {
  noteId: number;
  title: string;
}
