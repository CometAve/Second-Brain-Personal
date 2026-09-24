import { ExternalLink } from 'lucide-react';
import type { NoteSearchResult } from '@/types/note';

/**
 * NoteListItem (Molecule)
 * - 검색 결과 노트 항목
 * - 제목, 내용 미리보기, 유사도
 * - [전체보기] 버튼 → Side Panel 열기
 * - Hover 효과, 다크모드 지원
 */
interface NoteListItemProps {
  note: NoteSearchResult;
  similarity?: number;
  onViewDetail: () => void;
}

export function NoteListItem({ note, similarity, onViewDetail }: NoteListItemProps) {
  return (
    <div className="group rounded-lg border border-border/50 bg-background p-3 transition-all hover:border-primary hover:shadow-md">
      {/* Header: 제목 + 유사도 */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="line-clamp-1 flex-1 text-sm font-semibold text-foreground">{note.title}</h4>
        {similarity !== undefined && similarity > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {Math.round(similarity * 100)}%
          </span>
        )}
      </div>

      {/* 내용 미리보기 */}
      {note.content && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {note.content}
        </p>
      )}

      {/* 전체보기 버튼 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewDetail();
        }}
        className="flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
      >
        <ExternalLink className="size-3" />
        전체보기
      </button>
    </div>
  );
}
