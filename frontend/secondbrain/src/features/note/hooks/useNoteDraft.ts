import { useRef, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash-es';
import {
  saveDraft,
  getDraft,
  deleteDraft as deleteDraftApi,
  saveToDatabase as saveToDatabaseApi,
  draftQueries,
} from '@/api/client/draftApi';
import { deleteNotes as deleteNotesApi } from '@/api/client/noteApi';
import type { NoteDraftRequest } from '@/shared/types/draft.types';
import { isConflictError } from '@/shared/utils/typeGuards';

interface UseNoteDraftOptions {
  draftId: string;
  onSaveToDatabase?: (noteId: number) => void;
}

interface UseNoteDraftReturn {
  // 상태
  title: string;
  content: string;
  version: number;
  lastModified: Date | null;
  isLoading: boolean;
  isSaving: boolean;
  dbNoteId: number | null;

  // 핸들러
  handleTitleChange: (value: string) => void;
  handleContentChange: (value: string) => void;
  saveToDatabase: () => Promise<void>;
  deleteDraft: () => Promise<void>;
}

/**
 * Draft 자동 저장 훅
 *
 * 자동 저장 트리거:
 * 1. Debouncing (500ms) → POST /api/drafts
 * 2. Batching (50회 변경 or 5분 경과) → POST /api/notes/from-draft/{id}
 * 3. beforeunload → navigator.sendBeacon()
 *
 * @param options - draftId, onSaveToDatabase 콜백
 * @returns Draft 상태 및 핸들러
 */
export function useNoteDraft(options: UseNoteDraftOptions): UseNoteDraftReturn {
  const { draftId, onSaveToDatabase } = options;
  const queryClient = useQueryClient();

  // DB에 저장된 Note ID 추적
  const [dbNoteId, setDbNoteId] = useState<number | null>(null);

  // 로컬 상태 (타이핑 성능 최적화)
  const [localTitle, setLocalTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const [localVersion, setLocalVersion] = useState(1);

  // TanStack Query로 초기 데이터 로드
  const { data: draft, isLoading } = useQuery({
    queryKey: draftQueries.detail(draftId),
    queryFn: () => getDraft(draftId),
    retry: false,
    staleTime: Infinity,
    throwOnError: false, // 404 에러 무시 (새 Draft)
  });

  // 초기 로딩 완료 시 로컬 상태 초기화 (한 번만)
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (!isLoading && draft && !isInitialized) {
      setLocalTitle(draft.title || '');
      setLocalContent(draft.content || '');
      setLocalVersion(draft.version || 1);
      setIsInitialized(true);
    }
  }, [isLoading, draft, isInitialized]);

  // 자동 저장용 Refs
  const changeCountRef = useRef(0);
  const lastDbSaveTimeRef = useRef(Date.now());
  const isSavingToDbRef = useRef(false); // DB 저장 중 플래그

  // beforeunload를 위한 최신 값 추적
  const titleRef = useRef(localTitle);
  const contentRef = useRef(localContent);

  // titleRef, contentRef를 로컬 상태 변경 시 동기화
  useEffect(() => {
    titleRef.current = localTitle;
    contentRef.current = localContent;
  }, [localTitle, localContent]);

  // Redis 저장 Mutation (Optimistic Update 제거로 성능 개선)
  const saveMutation = useMutation({
    mutationFn: (data: NoteDraftRequest) => saveDraft(data),
    onSuccess: (response) => {
      // 서버 응답의 version으로 로컬 상태 동기화 (409 에러 방지)
      setLocalVersion(response.version);
      changeCountRef.current++;
      // Batching 조건 체크
      void checkAndSaveToDatabase();
    },
    onError: () => {
      // Fallback: LocalStorage
      localStorage.setItem(
        `draft:${draftId}`,
        JSON.stringify({
          noteId: draftId,
          title: titleRef.current,
          content: contentRef.current,
          version: localVersion,
        }),
      );
    },
  });

  // Batching: DB 저장 조건 체크
  const checkAndSaveToDatabase = async () => {
    const timeSinceLastSave = Date.now() - lastDbSaveTimeRef.current;
    const shouldSave =
      changeCountRef.current >= 50 || // 50회 변경
      timeSinceLastSave >= 5 * 60 * 1000; // 5분 경과

    if (shouldSave) {
      await saveToDatabase();
    }
  };

  // DB 저장 (멱등성 보장 + 방어 로직)
  const saveToDatabase = async () => {
    // 프론트엔드 중복 방지
    if (isSavingToDbRef.current) {
      console.warn('[Draft] 이미 DB 저장 중입니다');
      return;
    }

    // 최종 검증 (DB는 빈 값 불가)
    if (!localTitle.trim() || !localContent.trim()) {
      console.warn('[Draft] 제목 또는 내용이 비어있어 저장하지 않습니다');
      return;
    }

    isSavingToDbRef.current = true;

    try {
      const noteId = await saveToDatabaseApi(draftId);

      // DB Note ID 저장
      setDbNoteId(noteId);

      // 카운터 초기화
      changeCountRef.current = 0;
      lastDbSaveTimeRef.current = Date.now();

      // Draft 삭제 (실패 무시)
      try {
        await deleteDraftApi(draftId);
      } catch (error) {
        console.warn('[Draft] Redis 삭제 실패 (백엔드에서 처리됨)', error);
      }

      // 캐시 정리
      queryClient.removeQueries({ queryKey: draftQueries.detail(draftId) });

      // 콜백 호출
      if (onSaveToDatabase) {
        onSaveToDatabase(noteId);
      }
    } catch (error: unknown) {
      // 409 Conflict 처리 (이미 처리 중)
      if (isConflictError(error)) {
        console.info('[Draft] 이미 다른 요청에서 처리 중입니다');

        // 잠시 대기 후 Note 목록 새로고침
        await new Promise((resolve) => setTimeout(resolve, 1000));
        void queryClient.invalidateQueries({ queryKey: ['notes'] });
      } else {
        console.error('[Draft] DB 저장 실패', error);
        throw error;
      }
    } finally {
      isSavingToDbRef.current = false;
    }
  };

  // Debounced Redis 저장 (500ms)
  // React 공식 패턴: debounce 함수는 useRef로 저장
  // saveMutation.mutate는 TanStack Query가 안정적인 참조 보장
  const saveDraftToRedis = useRef(
    debounce((draft: NoteDraftRequest) => {
      // 최소 검증: title 또는 content 중 하나라도 있어야 함
      if (!draft.title?.trim() && !draft.content?.trim()) {
        return;
      }

      saveMutation.mutate(draft);
    }, 500),
  ).current;

  // beforeunload: 페이지 이탈 시 자동 저장 (useEffect 제거)
  // useRef로 핸들러 저장하여 최신 값 참조 보장
  const handleBeforeUnloadRef = useRef<() => void>();

  handleBeforeUnloadRef.current = () => {
    // DB 저장 중이면 sendBeacon 차단
    if (isSavingToDbRef.current) {
      console.info('[Draft] 이미 저장 중이므로 beforeunload 무시');
      return;
    }

    // ref로 최신 값 참조 (클로저 회피)
    if (titleRef.current.trim() && contentRef.current.trim()) {
      // Navigator.sendBeacon 사용 (비동기, 보장됨)
      navigator.sendBeacon(
        `/api/notes/from-draft/${draftId}`,
        new Blob(
          [
            JSON.stringify({
              title: titleRef.current,
              content: contentRef.current,
            }),
          ],
          {
            type: 'application/json',
          },
        ),
      );
    }
  };

  // 이벤트 리스너 등록 (한 번만 실행)
  useEffect(() => {
    const handleBeforeUnload = () => {
      handleBeforeUnloadRef.current?.();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []); // 빈 의존성 배열: 마운트 시 한 번만 등록

  // 핸들러 (로컬 상태 업데이트 + Debounced 서버 저장)
  // Optimistic Update 제거로 타이핑 성능 개선
  function handleTitleChange(newTitle: string) {
    // 로컬 상태만 즉시 업데이트 (빠름!)
    setLocalTitle(newTitle);

    // Debounced 서버 저장 (500ms)
    saveDraftToRedis({
      noteId: draftId,
      title: newTitle,
      content: contentRef.current,
      version: localVersion,
    });
  }

  function handleContentChange(newContent: string) {
    // 로컬 상태만 즉시 업데이트 (빠름!)
    setLocalContent(newContent);

    // Debounced 서버 저장 (500ms)
    saveDraftToRedis({
      noteId: draftId,
      title: titleRef.current,
      content: newContent,
      version: localVersion,
    });
  }

  const deleteDraft = async () => {
    // Redis Draft 삭제
    await deleteDraftApi(draftId);
    queryClient.removeQueries({ queryKey: draftQueries.detail(draftId) });

    // DB Note도 삭제 (존재하는 경우)
    if (dbNoteId) {
      await deleteNotesApi([dbNoteId]);
    }
  };

  return {
    title: localTitle,
    content: localContent,
    version: localVersion,
    lastModified: draft?.lastModified ? new Date(draft.lastModified) : null,
    isLoading,
    isSaving: saveMutation.isPending,
    dbNoteId,
    handleTitleChange,
    handleContentChange,
    saveToDatabase,
    deleteDraft,
  };
}
