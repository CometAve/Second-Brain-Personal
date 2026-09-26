import { lazy, Suspense, useCallback, useState } from 'react';
import { useSavedGraphNodes } from '@/features/main/hooks/useGraphVisualization';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';

const Graph = lazy(() =>
  import('@/features/main/components/Graph').then((module) => ({ default: module.Graph })),
);

/** Starts the graph request while its 3D bundle loads and owns one loading surface. */
export function GraphPanel() {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const [readyEpoch, setReadyEpoch] = useState<number | null>(null);
  const savedNodesQuery = useSavedGraphNodes();
  // A cold route follows the router's own pending gate. Show this loader
  // immediately so code splitting does not introduce another blank interval.
  const [delayMs] = useState(() => (savedNodesQuery.data === undefined ? 0 : 120));
  const ready = readyEpoch === sessionEpoch;
  const handleReady = useCallback(() => setReadyEpoch(sessionEpoch), [sessionEpoch]);

  return (
    <div className="relative size-full min-h-0 bg-[#10151f]">
      <div className="size-full" inert={!ready}>
        <Suspense fallback={null}>
          <Graph onReady={handleReady} />
        </Suspense>
      </div>
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#10151f]">
          <LoadingSpinner fullScreen={false} delayMs={delayMs} />
        </div>
      )}
    </div>
  );
}
