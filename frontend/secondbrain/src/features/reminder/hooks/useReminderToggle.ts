import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getCurrentUser } from '@/features/auth/services/userService';
import type { UserInfo } from '@/features/auth/types/auth';
import { toggleReminder } from '@/features/reminder/services/reminderService';
import {
  StaleSessionError,
  assertCurrentSession,
  captureSessionEpoch,
  isCurrentSession,
  useAuthStore,
} from '@/stores/authStore';

export function useReminderToggle() {
  const queryClient = useQueryClient();

  function syncVerifiedUser(epoch: number, user: UserInfo): void {
    assertCurrentSession(epoch);
    useAuthStore.getState().setUser(user);
    queryClient.setQueryData(['user', 'me', epoch], user);
  }

  const mutation = useMutation<UserInfo, Error, number>({
    // This endpoint is a relative toggle, so requests must run in click order.
    scope: { id: 'reminder-toggle' },
    mutationFn: async (epoch) => {
      await toggleReminder(epoch);
      const user = await getCurrentUser(epoch);
      assertCurrentSession(epoch);
      return user;
    },
    onSuccess: (user, epoch) => {
      if (isCurrentSession(epoch)) syncVerifiedUser(epoch, user);
    },
    onError: async (error, epoch) => {
      if (!isCurrentSession(epoch) || error instanceof StaleSessionError) return;
      // A lost response can follow a successful server toggle; inspect the server state.
      try {
        const user = await getCurrentUser(epoch);
        if (isCurrentSession(epoch)) syncVerifiedUser(epoch, user);
      } catch {
        // Keep the last verified state and allow the next explicit retry.
      }
      if (isCurrentSession(epoch))
        toast.error('리마인더 설정 상태를 확인하지 못했습니다. 다시 확인해 주세요.');
    },
    onSettled: (_data, _error, epoch) => {
      if (isCurrentSession(epoch)) {
        void queryClient.invalidateQueries({ queryKey: ['user', 'me', epoch] });
      }
    },
  });

  return {
    toggle: () => mutation.mutate(captureSessionEpoch()),
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
