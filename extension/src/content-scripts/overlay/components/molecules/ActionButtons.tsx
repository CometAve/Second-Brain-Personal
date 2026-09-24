import { useRef, useState } from 'react';
import { Plus, Download, Settings, FileText } from 'lucide-react';
import { Button } from '@/content-scripts/overlay/components/ui/button';
import { CounterBadge } from '@/content-scripts/overlay/components/atoms/CounterBadge';
import { SearchInput } from '@/content-scripts/overlay/components/atoms/SearchInput';
import { usePageCollectionStore } from '@/stores/pageCollectionStore';
import { usePendingTextSnippetsStore } from '@/stores/pendingTextSnippetsStore';
import { useSaveStatusStore } from '@/stores/saveStatusStore';
import { useNoteSearchStore } from '@/stores/noteSearchStore';
import browser from 'webextension-polyfill';
import { showToast } from '@/content-scripts/overlay/components/molecules/simpleToastStore';
import type { SavePageResponse, SavePageError } from '@/types/note';
import { debounce } from '@/lib/utils/debounce';

/**
 * 에러 코드를 사용자 친화적 메시지로 변환
 */
function getErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    NO_TOKEN: '로그인이 필요합니다',
    NO_TAB: '현재 탭을 찾을 수 없습니다',
    INVALID_URL: '이 페이지는 저장할 수 없습니다',
    API_ERROR: 'API 오류가 발생했습니다',
    NETWORK_ERROR: '네트워크 연결을 확인해주세요',
    UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다',
  };

  return errorMessages[errorCode] || errorMessages['UNKNOWN_ERROR'];
}

/**
 * Action Buttons (Molecule)
 * - 로그인 후 표시되는 액션 버튼들
 * - 검색바 + 페이지 추가, 저장 기능
 * - Shadcn UI + Tailwind CSS 기반
 */

type ActivePanel = null | 'urlList' | 'snippetsList' | 'saveStatus' | 'settings' | 'noteSearch';

interface ActionButtonsProps {
  activePanel: ActivePanel;
  onTogglePanel: (
    panel: 'urlList' | 'snippetsList' | 'saveStatus' | 'settings' | 'noteSearch',
  ) => void;
}

export function ActionButtons({ activePanel, onTogglePanel }: ActionButtonsProps) {
  const { pages, addPage, clearPages } = usePageCollectionStore();
  const { getSnippetCount } = usePendingTextSnippetsStore();
  const { getSavingCount } = useSaveStatusStore();
  const { search, clearSearch, setFocused } = useNoteSearchStore();

  // Local state로 검색어 관리 (즉시 반응)
  const [localKeyword, setLocalKeyword] = useState('');
  // 포커스 상태 (너비 확장용)
  const [isFocused, setIsFocused] = useState(false);

  // 실시간 검색을 위한 debounced search
  const debouncedSearchRef = useRef(
    debounce((searchKeyword: unknown) => {
      if (typeof searchKeyword === 'string' && searchKeyword.trim()) {
        void search(searchKeyword.trim());
      }
    }, 300),
  );

  // 파생 상태: 포커스 또는 검색 모드일 때 확장
  const isSearchMode = isFocused || activePanel === 'noteSearch';

  // 키워드 입력 핸들러 - 실시간 검색
  function handleKeywordChange(newKeyword: string) {
    setLocalKeyword(newKeyword);

    if (newKeyword.trim()) {
      // 검색어가 있으면 패널 열기 + 실시간 검색
      if (activePanel !== 'noteSearch') {
        onTogglePanel('noteSearch');
      }
      debouncedSearchRef.current(newKeyword);
    } else {
      // 검색어가 비었으면 패널 닫기
      if (activePanel === 'noteSearch') {
        onTogglePanel(null as never);
      }
    }
  }

  function handleSearchFocus() {
    setFocused(true);
    setIsFocused(true);

    // 포커스 시 다른 패널 닫기
    if (activePanel !== null && activePanel !== 'noteSearch') {
      onTogglePanel(null as never);
    }

    // 검색어가 있으면 패널 열기
    if (localKeyword.trim() && activePanel !== 'noteSearch') {
      onTogglePanel('noteSearch');
    }
  }

  function handleSearchBlur() {
    setFocused(false);
    // 검색어가 없으면 포커스 상태도 해제
    if (!localKeyword.trim()) {
      setIsFocused(false);
    }
  }

  function handleSearchCancel() {
    setLocalKeyword('');
    clearSearch();
    setFocused(false);
    setIsFocused(false);
    onTogglePanel(null as never);
  }

  function handleSearch() {
    if (localKeyword.trim()) {
      onTogglePanel('noteSearch');
      void search(localKeyword.trim());
    }
  }

  async function handleAddPage(): Promise<void> {
    const currentUrl = window.location.href;

    if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
      showToast('이 페이지는 추가할 수 없습니다', 'error');
      return;
    }

    const success = await addPage(currentUrl);

    if (success) {
      showToast('페이지가 추가되었습니다', 'success');
    } else {
      showToast('이미 추가된 페이지입니다', 'info');
    }
  }

  async function handleSave(): Promise<void> {
    try {
      const MAX_SAVE_COUNT = 20;
      const urlsToSave = Array.from(pages);
      const snippets = usePendingTextSnippetsStore.getState().snippets;
      const currentUrl = window.location.href;

      const formattedSnippets = snippets.map((snippet) => {
        return `=== 출처 정보 ===
URL: ${snippet.sourceUrl}
제목: ${snippet.pageTitle}
추가 시간: ${new Date(snippet.timestamp).toLocaleString('ko-KR')}

=== 선택된 텍스트 ===
${snippet.text}`;
      });

      let finalUrls = [...urlsToSave, ...formattedSnippets];

      if (finalUrls.length === 0) {
        finalUrls = [currentUrl];
      }

      if (finalUrls.length > MAX_SAVE_COUNT) {
        showToast(`한 번에 최대 ${MAX_SAVE_COUNT}개까지 저장할 수 있습니다`, 'info');
        finalUrls = finalUrls.slice(0, MAX_SAVE_COUNT);
      }

      const batchId = `batch_${Date.now()}`;
      const batchTimestamp = Date.now();

      if (activePanel !== 'saveStatus') {
        onTogglePanel('saveStatus');
      }

      const rawResponse: unknown = await browser.runtime.sendMessage({
        type: 'SAVE_CURRENT_PAGE',
        urls: finalUrls,
        batchId,
        batchTimestamp,
      });

      const response = rawResponse as SavePageResponse | SavePageError;

      if ('error' in response) {
        const errorMessage = getErrorMessage(response.error);
        showToast(`저장 실패: ${errorMessage}`, 'error');
      } else {
        const savedCount = finalUrls.length;
        showToast(
          savedCount > 1 ? `${savedCount}개 항목이 저장되었습니다` : '저장되었습니다',
          'success',
        );

        await clearPages();
        await usePendingTextSnippetsStore.getState().clearSnippets();
      }
    } catch (error) {
      console.error('Failed to save page:', error);
      showToast('저장 실패: 확장 프로그램 오류', 'error');
    }
  }

  const savingCount = getSavingCount();
  const pageCount = pages.size;
  const snippetCount = getSnippetCount();

  return (
    <div
      className={`relative rounded-xl border border-border bg-card p-4 shadow-lg transition-all duration-300 ${
        isSearchMode ? 'w-100' : 'w-80'
      }`}
    >
      {/* 검색바 (최상단, 항상 표시) */}
      <div className="mb-3">
        <SearchInput
          value={localKeyword}
          onChange={handleKeywordChange}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          onSearch={handleSearch}
          onCancel={handleSearchCancel}
          placeholder="노트 검색..."
        />
      </div>

      {/* 기존 버튼들 - 검색 모드가 아닐 때만 렌더링 (공백 제거!) */}
      {!isSearchMode && (
        <div className="space-y-2">
          {/* Add Button + Counter Badge */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-start gap-2 hover:bg-accent"
              onClick={() => void handleAddPage()}
            >
              <Plus className="size-4" />
              <span>Add URL</span>
            </Button>

            <CounterBadge count={pageCount} onClick={() => onTogglePanel('urlList')} />
          </div>

          {/* Snippets Button + Counter Badge */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-start gap-2 hover:bg-accent"
              onClick={() => onTogglePanel('snippetsList')}
            >
              <FileText className="size-4" />
              <span>임시 노트</span>
            </Button>

            <CounterBadge count={snippetCount} onClick={() => onTogglePanel('snippetsList')} />
          </div>

          {/* Save Button + Status Toggle */}
          <div className="relative flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 justify-start gap-2 hover:bg-accent"
              onClick={() => void handleSave()}
            >
              <Download className="size-4" />
              <span>Save</span>
            </Button>

            {savingCount > 0 && (
              <CounterBadge count={savingCount} onClick={() => onTogglePanel('saveStatus')} />
            )}
          </div>

          {/* Settings Button */}
          <Button
            variant="outline"
            className="w-full justify-start gap-2 hover:bg-accent"
            onClick={() => onTogglePanel('settings')}
          >
            <Settings className="size-4" />
            <span>드래그 검색 설정</span>
          </Button>
        </div>
      )}
    </div>
  );
}
