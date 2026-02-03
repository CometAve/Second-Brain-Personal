import { useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { debounce } from 'lodash-es';
import { saveDraft } from '@/api/client/draftApi';
import type { NoteDraftRequest, NoteDraftResponse } from '@/shared/types/draft.types';

interface UseDebouncedSaveOptions {
  draftId: string;
  onSuccess?: (response: NoteDraftResponse) => void;
  onError?: (draft: NoteDraftRequest) => void;
  debounceMs?: number;
}

interface UseDebouncedSaveReturn {
  save: (draft: NoteDraftRequest) => void;
  isSaving: boolean;
}

/**
 * Debounced Draft 저장 훅
 * - 지정된 시간(기본 500ms) 동안 입력이 없으면 서버에 저장
 * - 저장 실패 시 onError 콜백 호출
 */
export function useDebouncedSave({
  onSuccess,
  onError,
  debounceMs = 500,
}: UseDebouncedSaveOptions): UseDebouncedSaveReturn {
  // Redis 저장 Mutation
  const saveMutation = useMutation({
    mutationFn: (data: NoteDraftRequest) => saveDraft(data),
    onSuccess: (response) => {
      onSuccess?.(response);
    },
    onError: (_error, variables) => {
      onError?.(variables);
    },
  });

  // Debounced 저장 함수 (useRef로 안정적인 참조 유지)
  const debouncedSave = useRef(
    debounce((draft: NoteDraftRequest) => {
      // 최소 검증: title 또는 content 중 하나라도 있어야 함
      if (!draft.title?.trim() && !draft.content?.trim()) {
        return;
      }
      saveMutation.mutate(draft);
    }, debounceMs),
  ).current;

  const save = useCallback(
    (draft: NoteDraftRequest) => {
      debouncedSave(draft);
    },
    [debouncedSave],
  );

  return {
    save,
    isSaving: saveMutation.isPending,
  };
}
