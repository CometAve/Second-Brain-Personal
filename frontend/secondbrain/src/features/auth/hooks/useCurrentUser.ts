import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/features/auth/services/userService';
import { useAuthStore } from '@/stores/authStore';

export function useCurrentUser() {
  const sessionEpoch = useAuthStore((state) => state.sessionEpoch);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const restoredUser = useAuthStore((state) => state.user);

  return useQuery({
    queryKey: ['user', 'me', sessionEpoch],
    queryFn: ({ signal }) => getCurrentUser(sessionEpoch, signal),
    enabled: isAuthenticated,
    // Session restoration already validated this user with the server. Seed
    // the same-epoch query so entering main does not repeat that blocking load.
    initialData: isAuthenticated ? (restoredUser ?? undefined) : undefined,
    staleTime: 5 * 60 * 1000,
  });
}
