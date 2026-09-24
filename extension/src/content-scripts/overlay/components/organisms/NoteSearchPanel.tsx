import { Loader2, FileText } from 'lucide-react';
import { NoteListItem } from '@/content-scripts/overlay/components/molecules/NoteListItem';
import { NoteListSkeleton } from '@/content-scripts/overlay/components/atoms/Skeleton';
import type { NoteSearchResult } from '@/types/note';

/**
 * NoteSearchPanel (Organism)
 * - 노트 검색 결과 패널
 * - Elasticsearch 노트 목록 표시
 * - 로딩/에러 상태 처리
 * - [전체보기] → Side Panel 열기
 */
interface NoteSearchPanelProps {
  keyword: string;
  notesList: NoteSearchResult[];
  isLoading: boolean;
  error: string | null;
  onViewDetail: (noteId: number) => void;
}

export function NoteSearchPanel({
  keyword,
  notesList,
  isLoading,
  error,
  onViewDetail,
}: NoteSearchPanelProps) {
  // 에러 상태 (검색 시작 전)
  if (error && !isLoading && notesList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-2 rounded-full bg-red-50 p-2 dark:bg-red-950">
          <FileText className="size-6 text-red-500" />
        </div>
        <p className="text-sm font-medium text-foreground">검색 중 오류가 발생했습니다</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  // 로딩 중이면서 아무 결과도 없을 때만 로딩 스피너
  if (isLoading && notesList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">검색 중...</p>
        </div>
      </div>
    );
  }

  // 모든 검색 완료했지만 결과 없음
  if (!isLoading && notesList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-2 rounded-full bg-muted p-2">
          <FileText className="size-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          &quot;{keyword}&quot;와 관련된 노트가 없습니다
        </p>
        <p className="mt-1 text-xs text-muted-foreground">다른 키워드로 검색해보세요</p>
      </div>
    );
  }

  // 검색 결과 표시
  return (
    <div className="flex w-100 flex-col gap-4">
      {/* 관련 노트 섹션 */}
      {notesList.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="size-4" />
              관련 노트
            </h3>
          </div>

          {/* 노트 리스트에만 스크롤 적용 - 3개 초과시에만 스크롤 */}
          <div
            className={`flex flex-col gap-2 ${notesList.length > 3 ? 'max-h-60 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent' : ''}`}
          >
            {notesList.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                similarity={note.score}
                onViewDetail={() => onViewDetail(note.id)}
              />
            ))}
          </div>
        </div>
      ) : isLoading ? (
        <NoteListSkeleton count={5} />
      ) : null}
    </div>
  );
}
