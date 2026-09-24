/**
 * Counter Badge (Atom)
 * - 수집된 페이지 개수 표시
 * - 클릭 시 URL 목록 열기
 * - 0개일 때는 표시하지 않음
 */
interface CounterBadgeProps {
  count: number;
  onClick: () => void;
}

export function CounterBadge({ count, onClick }: CounterBadgeProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-md bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground transition-all hover:scale-105 hover:bg-primary/90 active:scale-95"
      type="button"
      aria-label={`${count}개 항목`}
    >
      {count}
    </button>
  );
}
