import { useQuery } from '@tanstack/react-query';
import { graphAPI, savedGraphNodesAPI } from '@/features/main/services/graphService';
import { useAuthStore } from '@/stores/authStore';

export function useSavedGraphNodes() {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['notes', 'graph', sessionEpoch],
    queryFn: ({ signal }) => savedGraphNodesAPI.getSavedGraphNodes(sessionEpoch, signal),
    enabled: isAuthenticated,
  });
}

export function useGraphVisualization(hasSavedNotes: boolean) {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['graphs', 'visualization', sessionEpoch],
    queryFn: ({ signal }) => graphAPI.getGraphVisualization(sessionEpoch, signal),
    enabled: isAuthenticated && hasSavedNotes,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: true,
    retry: 2, // 실패 시 2번 재시도
  });
}
