import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { deleteApiKey } from '@/features/auth/api/apiKey';
import { StaleSessionError, assertCurrentSession } from '@/stores/authStore';

export function useDeleteApiKey() {
  return useMutation({
    mutationFn: async (epoch: number) => {
      await deleteApiKey(epoch);
      assertCurrentSession(epoch);
    },
    onSuccess: () => toast.success('API Key가 삭제되었습니다.'),
    onError: (error) => {
      if (!(error instanceof StaleSessionError)) toast.error('API Key 삭제에 실패했습니다.');
    },
  });
}
