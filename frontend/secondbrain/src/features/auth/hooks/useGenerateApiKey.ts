import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { generateApiKey } from '@/features/auth/api/apiKey';
import { StaleSessionError, assertCurrentSession } from '@/stores/authStore';

export function useGenerateApiKey() {
  return useMutation({
    mutationFn: async (epoch: number) => {
      const key = await generateApiKey(epoch);
      assertCurrentSession(epoch);
      return key;
    },
    onError: (error) => {
      if (!(error instanceof StaleSessionError)) toast.error('API Key 발급에 실패했습니다.');
    },
  });
}
