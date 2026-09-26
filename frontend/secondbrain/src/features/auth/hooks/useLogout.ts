import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { logout } from '@/features/auth/services/authService';
import { StaleSessionError, isCurrentSession, useAuthStore } from '@/stores/authStore';

export function useLogout() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (epoch: number) => {
      await logout(epoch);
      return epoch;
    },
    onSuccess: (epoch) => {
      if (!isCurrentSession(epoch)) return;
      useAuthStore.getState().clearAuth();
      void navigate({ to: '/' });
    },
    onError: (error, epoch) => {
      if (isCurrentSession(epoch) && !(error instanceof StaleSessionError)) {
        toast.error('로그아웃하지 못했습니다. 다시 시도해 주세요.');
      }
    },
  });
}
