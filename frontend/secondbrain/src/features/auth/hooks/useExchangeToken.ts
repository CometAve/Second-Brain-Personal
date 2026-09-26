import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { exchangeToken } from '@/features/auth/services/authService';
import { getCurrentUser } from '@/features/auth/services/userService';
import { isCurrentSession, useAuthStore } from '@/stores/authStore';

export function useExchangeToken() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ code, epoch }: { code: string; epoch: number }) => {
      try {
        const token = await exchangeToken(code, epoch);
        const user = await getCurrentUser(epoch, undefined, token.accessToken);
        const finalToken = useAuthStore.getState().accessToken ?? token.accessToken;
        useAuthStore.getState().completeSession(epoch, finalToken, user);
        return epoch;
      } catch (error) {
        if (isCurrentSession(epoch)) {
          useAuthStore.getState().clearAuth();
          void navigate({ to: '/', search: { error: 'login_failed' }, replace: true });
        }
        throw error;
      }
    },
    onSuccess: (epoch) => {
      if (isCurrentSession(epoch)) void navigate({ to: '/main', replace: true });
    },
  });
}
