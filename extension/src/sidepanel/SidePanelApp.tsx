import { useEffect, useState } from 'react';
import { Loader2, FileText, Link2, ChevronRight } from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview/nohighlight';
import browser from 'webextension-polyfill';
import type { NoteDetail } from '@/types/noteSearch';
import { getNoteDetail } from '@/services/noteSearchService';
import { getRelatedNotes, type RelatedNoteItem } from '@/services/relatedNotesService';

/**
 * Side Panel 메인 앱
 * - Chrome Side Panel에서 노트 전체 내용 표시
 * - @uiw/react-markdown-preview로 GitHub 스타일 마크다운 렌더링
 * - 시스템 다크모드 자동 감지
 * - 관련 노트 목록 표시 및 네비게이션
 */
export function SidePanelApp() {
  const [noteId, setNoteId] = useState<number | null>(null);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [relatedNotes, setRelatedNotes] = useState<RelatedNoteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  );

  // Storage에서 noteId 읽기
  useEffect(() => {
    // 초기 로드
    void browser.storage.local.get(['currentNoteId']).then((result) => {
      if (result.currentNoteId) {
        setNoteId(result.currentNoteId as number);
      }
    });

    // Storage 변경 감지 (다른 노트로 전환 시)
    const handleStorageChange = (
      changes: Record<string, browser.Storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === 'local') {
        if (changes.currentNoteId) {
          setNoteId(changes.currentNoteId.newValue as number);
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // 시스템 다크모드 감지 및 적용
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // 초기 설정
    const applyTheme = (isDark: boolean) => {
      const mode = isDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-color-mode', mode);
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme(mediaQuery.matches);

    // 시스템 테마 변경 감지
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches);
      setColorMode(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Note 데이터 및 관련 노트 병렬 가져오기
  useEffect(() => {
    if (noteId === null) return;

    async function fetchData() {
      if (noteId === null) return;

      setIsLoading(true);
      setError(null);

      try {
        // 노트 상세와 관련 노트를 병렬로 호출
        const [noteData, relatedData] = await Promise.all([
          getNoteDetail(noteId),
          getRelatedNotes(noteId, 1).catch((err) => {
            console.warn('[SidePanelApp] Failed to fetch related notes:', err);
            return [];
          }),
        ]);

        console.log('[SidePanelApp] Related notes:', relatedData);
        setNote(noteData);
        setRelatedNotes(relatedData);
      } catch (err) {
        console.error('[SidePanelApp] Failed to fetch note:', err);
        setError(err instanceof Error ? err.message : '노트를 불러올 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    }

    void fetchData();
  }, [noteId]);

  // 관련 노트 클릭 핸들러
  const handleRelatedNoteClick = async (relatedNoteId: number) => {
    // Storage에 새 noteId 저장 → useEffect가 감지하여 재렌더링
    await browser.storage.local.set({ currentNoteId: relatedNoteId });
  };

  // 노트 선택 안됨 상태
  if (noteId === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <FileText className="size-12 text-neutral-400" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">노트를 선택해주세요</p>
        </div>
      </div>
    );
  }

  // 로딩 상태
  if (isLoading || !note) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">노트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-6 text-center dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-red-50 p-3 dark:bg-red-950">
            <FileText className="size-12 text-red-500" />
          </div>
          <div>
            <p className="mb-2 text-base font-medium text-neutral-900 dark:text-neutral-100">
              오류 발생
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // 노트 표시
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-neutral-900">
      {/* Header - 날짜 정보만 표시 */}
      <div className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-6 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          생성: {new Date(note.createdAt).toLocaleDateString('ko-KR')}
          {note.updatedAt && note.updatedAt !== note.createdAt && (
            <> · 수정: {new Date(note.updatedAt).toLocaleDateString('ko-KR')}</>
          )}
        </span>
      </div>

      {/* Content - GitHub 스타일 마크다운 렌더링 */}
      <div className="scrollbar-custom flex-1 overflow-y-auto px-6 py-4">
        <MarkdownPreview
          source={note.content}
          wrapperElement={{
            'data-color-mode': colorMode,
          }}
          style={{
            backgroundColor: 'transparent',
            padding: '0 8px',
          }}
        />

        {/* 관련 노트 섹션 - 마크다운 스타일 */}
        {relatedNotes.length > 0 && (
          <div className="mt-12 border-t border-neutral-200 pt-8 dark:border-neutral-700">
            <h2 className="mb-6 flex items-center gap-2 border-b border-neutral-200 pb-3 text-lg font-bold text-neutral-900 dark:border-neutral-700 dark:text-neutral-100">
              <Link2 className="size-5 text-blue-500" />
              관련 노트
              <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                ({relatedNotes.length})
              </span>
            </h2>
            <ul className="space-y-3">
              {relatedNotes.map((related) => (
                <li key={related.id}>
                  <button
                    onClick={() => void handleRelatedNoteClick(related.id)}
                    className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <ChevronRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                    <span className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                      {related.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
