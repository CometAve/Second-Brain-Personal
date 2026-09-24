/**
 * Skeleton (Atom)
 * - 로딩 스켈레톤 컴포넌트
 * - 다크모드 지원
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
      role="status"
      aria-label="로딩 중"
    />
  );
}

/**
 * 노트 리스트용 스켈레톤 - 실제 NoteListItem과 동일한 레이아웃
 */
export function NoteListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/50 bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-1 h-3 w-11/12" />
          </div>
        ))}
      </div>
    </div>
  );
}
