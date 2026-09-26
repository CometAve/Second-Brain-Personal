import { useQuery } from '@tanstack/react-query';

import { refreshToken } from '@/features/auth/services/authService';
import { getCurrentUser } from '@/features/auth/services/userService';
import { captureSessionEpoch, useAuthStore } from '@/stores/authStore';

/** Optional UI observer; the root route owns the initial restore barrier. */
export function useSessionRestore() {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['session', 'restore', sessionEpoch],
    queryFn: async ({ signal }) => {
      const token = await refreshToken(sessionEpoch, signal);
      if (!token) return null;
      const user = await getCurrentUser(sessionEpoch, signal, token.accessToken);
      const finalToken = useAuthStore.getState().accessToken ?? token.accessToken;
      useAuthStore.getState().completeSession(sessionEpoch, finalToken, user);
      return user;
    },
    enabled: !isAuthenticated && sessionEpoch === captureSessionEpoch(),
    retry: false,
    staleTime: Infinity,
  });
}
