import { useState } from 'react';
import { Toolbar } from '@/content-scripts/overlay/components/molecules/Toolbar';
import { AuthCard } from '@/content-scripts/overlay/components/molecules/AuthCard';
import { ActionButtons } from '@/content-scripts/overlay/components/molecules/ActionButtons';
import { FloatingButton } from '@/content-scripts/overlay/components/atoms/FloatingButton';
import { DragSearchPanel } from '@/content-scripts/overlay/components/organisms/DragSearchPanel';
import { NoteSearchPanel } from '@/content-scripts/overlay/components/organisms/NoteSearchPanel';
import { URLListModal } from '@/content-scripts/overlay/components/organisms/URLListModal';
import { PendingTextSnippetsPanel } from '@/content-scripts/overlay/components/organisms/PendingTextSnippetsPanel';
import { SaveStatusPanel } from '@/content-scripts/overlay/components/organisms/SaveStatusPanel';
import { DragSearchSettingsPanel } from '@/content-scripts/overlay/components/organisms/DragSearchSettingsPanel';
import { useExtensionAuth } from '@/hooks/useExtensionAuth';
import { useOverlayState } from '@/hooks/useOverlayState';
import { usePageCollectionStore } from '@/stores/pageCollectionStore';
import { usePendingTextSnippetsStore } from '@/stores/pendingTextSnippetsStore';
import { useDragSearchStore } from '@/stores/dragSearchStore';
import { useNoteSearchStore } from '@/stores/noteSearchStore';
import { useSaveStatusStore } from '@/stores/saveStatusStore';
import browser from 'webextension-polyfill';

type ActivePanel = null | 'urlList' | 'snippetsList' | 'saveStatus' | 'settings' | 'noteSearch';

/**
 * Extension Overlay (Organism)
 * - Chrome 확장프로그램 메인 Overlay 컴포넌트
 * - 인증 상태에 따라 LoginPrompt 또는 ActionButtons 렌더링
 * - Collapsed/Expanded 상태 관리
 * - Outside click으로 닫기 기능
 * - Smooth expand/collapse animations
 */
interface ExtensionOverlayProps {
  isOpen: boolean;
  onToggle: (visible: boolean) => void;
}

export function ExtensionOverlay({ isOpen, onToggle }: ExtensionOverlayProps) {
  const { loading, authenticated, user, logout } = useExtensionAuth();
  const { isExpanded, isCollapsed, isHidden, expand, collapse } = useOverlayState();
  const { getPageList, removePage, clearPages } = usePageCollectionStore();
  const { getSnippetList, removeSnippet, clearSnippets } = usePendingTextSnippetsStore();
  // saveStatusStore는 자동 초기화됨
  useSaveStatusStore();
  const {
    keyword,
    results,
    totalCount,
    isLoading,
    error,
    isVisible: isDragSearchVisible,
  } = useDragSearchStore();
  const {
    keyword: searchKeyword,
    notesList,
    isSearching,
    error: searchError,
  } = useNoteSearchStore();
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'expanding' | 'collapsing'>('idle');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Escape 키 핸들러 (이벤트 위임 방식)
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && isExpanded && isOpen) {
      onToggle(false);
    }
  };

  // Animation handling for expand/collapse
  const handleExpand = () => {
    setAnimationPhase('expanding');
    setIsAnimating(true);
    void expand();
    onToggle(true); // 부모의 isOpen 상태도 함께 업데이트
    setTimeout(() => {
      setIsAnimating(false);
      setAnimationPhase('idle');
    }, 300);
  };

  const handleCollapse = () => {
    setAnimationPhase('collapsing');
    setIsAnimating(true);
    setTimeout(() => {
      void collapse();
      setIsAnimating(false);
      setAnimationPhase('idle');
    }, 300);
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    void (async () => {
      try {
        await logout();
      } finally {
        // Keep showing animation for a bit longer for visual feedback
        setTimeout(() => {
          setIsLoggingOut(false);
        }, 500);
      }
    })();
  };

  function handleTogglePanel(
    panel: 'urlList' | 'snippetsList' | 'saveStatus' | 'settings' | 'noteSearch',
  ): void {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  // Side Panel 열기 핸들러
  function handleOpenSidePanel(noteId: number): void {
    void (async () => {
      try {
        // Content Script에서는 browser.windows API 사용 불가
        // Background에서 sender.tab.id를 사용하므로 windowId 불필요
        const response = await browser.runtime.sendMessage({
          type: 'OPEN_SIDE_PANEL',
          noteId,
        });

        // 타입 가드로 응답 확인
        const isSuccess =
          response &&
          typeof response === 'object' &&
          'success' in response &&
          response.success === true;

        if (!isSuccess) {
          const errorMsg =
            response && typeof response === 'object' && 'error' in response
              ? response.error
              : 'Unknown error';
          console.warn('[ExtensionOverlay] Side panel failed:', errorMsg);
          window.open(`https://brainsecond.site/notes/${noteId}`, '_blank');
        }
      } catch (error) {
        console.error('[ExtensionOverlay] Failed to open side panel:', error);
        // Fallback: 웹 앱에서 열기
        window.open(`https://brainsecond.site/notes/${noteId}`, '_blank');
      }
    })();
  }

  // Collapsed 상태: Floating 버튼만 표시 (with animation)
  if (isCollapsed && !isAnimating) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
          animation:
            animationPhase === 'idle' ? 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : undefined,
        }}
      >
        <FloatingButton onClick={handleExpand} />
      </div>
    );
  }

  // Hidden 상태 또는 isOpen이 false: 아무것도 표시 안함
  if (isHidden || (!isOpen && !isAnimating)) {
    return null;
  }

  // Expanded 상태 또는 애니메이션 중: 전체 UI 표시
  return (
    <div
      className="fixed top-4 right-4 z-9999"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        opacity: animationPhase === 'collapsing' ? 0 : 1,
        transform:
          animationPhase === 'expanding'
            ? 'scale(1) translateY(0)'
            : animationPhase === 'collapsing'
              ? 'scale(0.95) translateY(-10px)'
              : 'scale(1) translateY(0)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: isOpen && isExpanded && !isAnimating ? 'auto' : 'none',
      }}
    >
      <div className="extension-overlay-border rounded-xl bg-background shadow-2xl">
        <Toolbar
          authenticated={authenticated}
          user={user}
          onCollapse={handleCollapse}
          onClose={() => {
            onToggle(false);
          }}
          onLogout={handleLogout}
        />

        <div className="p-4">
          {/* 드래그 검색 결과 패널 (인증 완료 후 표시) */}
          {authenticated && !loading && !isLoggingOut && isDragSearchVisible && (
            <div className="mb-4">
              <DragSearchPanel
                keyword={keyword}
                results={results}
                totalCount={totalCount}
                isLoading={isLoading}
                error={error}
              />
            </div>
          )}

          {/* Transition wrapper - 부드러운 크기 조절 애니메이션 */}
          <div className="relative">
            {/* AuthCard wrapper - overflow-hidden 개별 적용 */}
            <div className="overflow-hidden">
              <div
                className={`transition-all duration-500 ease-in-out ${
                  loading || isLoggingOut || !authenticated
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none absolute top-0 left-0 w-full -translate-y-full opacity-0'
                }`}
              >
                <AuthCard
                  state={loading || isLoggingOut ? 'loading' : 'login'}
                  message={isLoggingOut ? '로그아웃 중...' : '로딩 중...'}
                />
              </div>
            </div>

            {/* ActionButtons - 아래에서 슬라이드 + 페이드 인 */}
            <div
              className={`transition-all duration-500 ease-in-out ${
                !loading && !isLoggingOut && authenticated
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-full opacity-0'
              }`}
            >
              {!loading && !isLoggingOut && authenticated && (
                <ActionButtons activePanel={activePanel} onTogglePanel={handleTogglePanel} />
              )}
            </div>

            {/* 패널 영역 - 드롭다운처럼 펼쳐짐 */}
            {!loading && !isLoggingOut && authenticated && (
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  activePanel === 'settings'
                    ? 'mt-4 max-h-150 opacity-100'
                    : activePanel === 'noteSearch'
                      ? 'mt-4 w-100 opacity-100'
                      : activePanel
                        ? 'mt-4 max-h-100 opacity-100'
                        : 'max-h-0 opacity-0'
                }`}
              >
                {activePanel && (
                  <div className="relative">
                    {/* NoteSearchPanel */}
                    <div
                      className={`transition-opacity duration-150 ${
                        activePanel === 'noteSearch'
                          ? 'opacity-100'
                          : 'pointer-events-none absolute inset-0 opacity-0'
                      }`}
                    >
                      <NoteSearchPanel
                        keyword={searchKeyword}
                        notesList={notesList}
                        isLoading={isSearching}
                        error={searchError}
                        onViewDetail={handleOpenSidePanel}
                      />
                    </div>

                    {/* URLListModal */}
                    <div
                      className={`transition-opacity duration-150 ${
                        activePanel === 'urlList'
                          ? 'opacity-100'
                          : 'pointer-events-none absolute inset-0 opacity-0'
                      }`}
                    >
                      <URLListModal
                        isOpen={activePanel === 'urlList'}
                        onClose={() => setActivePanel(null)}
                        urls={getPageList()}
                        onRemove={(url: string) => {
                          void removePage(url);
                        }}
                        onClearAll={() => {
                          void clearPages();
                          setActivePanel(null);
                        }}
                      />
                    </div>

                    {/* PendingTextSnippetsPanel */}
                    <div
                      className={`transition-opacity duration-150 ${
                        activePanel === 'snippetsList'
                          ? 'opacity-100'
                          : 'pointer-events-none absolute inset-0 opacity-0'
                      }`}
                    >
                      <PendingTextSnippetsPanel
                        isOpen={activePanel === 'snippetsList'}
                        onClose={() => setActivePanel(null)}
                        snippets={getSnippetList()}
                        onRemove={(id: string) => {
                          void removeSnippet(id);
                        }}
                        onClearAll={() => {
                          void clearSnippets();
                          setActivePanel(null);
                        }}
                      />
                    </div>

                    {/* SaveStatusPanel */}
                    <div
                      className={`transition-opacity duration-150 ${
                        activePanel === 'saveStatus'
                          ? 'opacity-100'
                          : 'pointer-events-none absolute inset-0 opacity-0'
                      }`}
                    >
                      <SaveStatusPanel
                        isOpen={activePanel === 'saveStatus'}
                        onClose={() => setActivePanel(null)}
                      />
                    </div>

                    {/* DragSearchSettingsPanel */}
                    <div
                      className={`transition-opacity duration-150 ${
                        activePanel === 'settings'
                          ? 'opacity-100'
                          : 'pointer-events-none absolute inset-0 opacity-0'
                      }`}
                    >
                      <DragSearchSettingsPanel onClose={() => setActivePanel(null)} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
