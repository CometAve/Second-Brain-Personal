import { useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  /**
   * 무한 스크롤 활성화 여부
   */
  enabled: boolean;

  /**
   * TanStack Query의 hasNextPage
   */
  hasNextPage: boolean | undefined;

  /**
   * TanStack Query의 isFetchingNextPage
   */
  isFetchingNextPage: boolean;

  /**
   * TanStack Query의 fetchNextPage 함수
   */
  fetchNextPage: () => Promise<unknown> | void;

  /**
   * 스크롤 컨테이너 선택자 (기본: '[data-scroll-container="true"]')
   */
  scrollContainerSelector?: string;

  /**
   * IntersectionObserver threshold (기본: 0.1)
   * - 요소의 몇 %가 보일 때 트리거할지 결정
   * - 0.0 ~ 1.0 사이 값
   */
  threshold?: number;

  /**
   * IntersectionObserver rootMargin (기본: '0px')
   * - root의 여백을 확장/축소
   * - 예: '100px' → 화면 밖 100px 전부터 감지
   */
  rootMargin?: string;
}

interface UseInfiniteScrollReturn {
  /**
   * 감지 대상 요소에 연결할 ref
   * - 이 ref를 리스트 끝부분의 요소에 연결
   * - 일반적으로 마지막 3개 항목 중 하나에 배치
   */
  observerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * TanStack Query useInfiniteQuery와 통합된 무한 스크롤 훅
 *
 * @description
 * - IntersectionObserver를 사용한 자동 페이지 로딩
 * - TanStack Query의 fetchNextPage와 완벽 통합
 * - 중복 요청 방지 (isFetchingNextPage 체크)
 * - 커스터마이징 가능한 threshold 및 rootMargin
 *
 * @example
 * ```tsx
 * const searchQuery = useInfiniteQuery({
 *   queryKey: ['search', query],
 *   queryFn: ({ pageParam }) => fetchSearchResults(query, pageParam),
 *   getNextPageParam: (lastPage) => lastPage.nextCursor,
 * });
 *
 * const { observerRef } = useInfiniteScroll({
 *   enabled: true,
 *   hasNextPage: searchQuery.hasNextPage,
 *   isFetchingNextPage: searchQuery.isFetchingNextPage,
 *   fetchNextPage: searchQuery.fetchNextPage,
 * });
 *
 * return (
 *   <div>
 *     {items.map((item, index) => (
 *       <div key={item.id}>
 *         <Item item={item} />
 *         {index === items.length - 3 && <div ref={observerRef} className="h-1" />}
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useInfiniteScroll({
  enabled,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  scrollContainerSelector = '[data-scroll-container="true"]',
  threshold = 0.1,
  rootMargin = '0px',
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 비활성화 상태이거나 ref가 없으면 early return
    if (!enabled || !observerRef.current) return;

    // 스크롤 컨테이너 찾기
    const scrollContainer = observerRef.current.closest(scrollContainerSelector) as HTMLElement;

    // IntersectionObserver 생성
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        // 조건: 화면에 보이고, 다음 페이지가 있고, 현재 로딩 중이 아닐 때
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      {
        root: scrollContainer,
        rootMargin,
        threshold,
      },
    );

    // 관찰 시작
    observer.observe(observerRef.current);

    // cleanup: 관찰 중단
    return () => {
      observer.disconnect();
    };
  }, [
    enabled,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    scrollContainerSelector,
    threshold,
    rootMargin,
  ]);

  return { observerRef };
}
