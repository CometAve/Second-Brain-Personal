import { createRootRoute } from '@tanstack/react-router';

import { SessionRestoreError } from '@/features/auth/components/SessionRestoreError';
import { refreshToken } from '@/features/auth/services/authService';
import { getCurrentUser } from '@/features/auth/services/userService';
import { RootLayout } from '@/layouts/RootLayout';
import { queryClient } from '@/lib/queryClient';
import { StaleSessionError, captureSessionEpoch, useAuthStore } from '@/stores/authStore';

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: SessionRestoreError,
  beforeLoad: async ({ location }) => {
    // The OAuth callback must be able to exchange its one-time code even if
    // an older refresh cookie is unavailable or the refresh service is down.
    if (location.pathname === '/auth/callback') {
      return { auth: { isAuthenticated: false } };
    }
    if (!useAuthStore.getState().isAuthenticated) {
      const epoch = captureSessionEpoch();
      try {
        await queryClient.ensureQueryData({
          queryKey: ['session', 'restore', epoch],
          queryFn: async ({ signal }) => {
            const token = await refreshToken(epoch, signal);
            if (!token) return null;
            const user = await getCurrentUser(epoch, signal, token.accessToken);
            const finalToken = useAuthStore.getState().accessToken ?? token.accessToken;
            useAuthStore.getState().completeSession(epoch, finalToken, user);
            return user;
          },
          retry: false,
          staleTime: Infinity,
        });
      } catch (error) {
        if (error instanceof StaleSessionError) {
          // Another login or logout owns the current route result.
        } else {
          // Do not expose an Axios config (including Authorization) through error.cause.
          // eslint-disable-next-line preserve-caught-error
          throw new Error('Session restore failed');
        }
      }
    }

    return { auth: { isAuthenticated: useAuthStore.getState().isAuthenticated } };
  },
});
