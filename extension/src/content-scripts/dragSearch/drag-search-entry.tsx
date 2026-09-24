import ReactDOM from 'react-dom/client';
import browser from 'webextension-polyfill';
import { DragSearchListener } from './DragSearchListener';
import { FloatingSearchButton } from './FloatingSearchButton';
import { CompactSearchPopup } from './CompactSearchPopup';
import type {
  DragSearchMessage,
  DragSearchResponse,
  DragSearchSettings,
  FloatingButtonPosition,
} from '@/types/dragSearch';
import type { NoteSearchResult } from '@/types/note';

// 기본 설정
const DEFAULT_SETTINGS: DragSearchSettings = {
  enabled: true,
  minTextLength: 2,
  debounceMs: 300,
  autoHideMs: 3000,
  excludedDomains: [],
};

/**
 * 드래그 검색 매니저
 * Content Script에서 드래그 검색 기능 총괄 관리
 */
class DragSearchManager {
  private listener: DragSearchListener | null = null;
  private floatingButtonRoot: ReactDOM.Root | null = null;
  private floatingButtonContainer: HTMLDivElement | null = null;
  private compactPopupRoot: ReactDOM.Root | null = null;
  private compactPopupContainer: HTMLDivElement | null = null;
  private currentKeyword = '';
  private currentSourceUrl = '';
  private currentPageTitle = '';
  private currentDragPosition: FloatingButtonPosition = { x: 0, y: 0 };
  private settings: DragSearchSettings = DEFAULT_SETTINGS;

  /**
   * 초기화
   */
  async initialize(): Promise<void> {
    // 설정 로드
    const stored = await browser.storage.local.get(['dragSearchSettings']);
    if (stored.dragSearchSettings) {
      this.settings = { ...DEFAULT_SETTINGS, ...stored.dragSearchSettings };
    }

    // 리스너 초기화
    this.listener = new DragSearchListener(this.settings, this.handleDragSearch);

    // Background로부터 응답 수신
    browser.runtime.onMessage.addListener(this.handleBackgroundMessage);

    // Storage 변경 감지 (설정 업데이트)
    browser.storage.onChanged.addListener(this.handleStorageChange);
  }

  /**
   * 드래그 감지 콜백
   */
  private handleDragSearch = (keyword: string, position: FloatingButtonPosition): void => {
    this.currentKeyword = keyword;
    this.currentSourceUrl = window.location.href;
    this.currentPageTitle = document.title;
    this.currentDragPosition = position;
    this.showFloatingButton(position);
  };

  /**
   * 플로팅 버튼 표시 (Shadow DOM 사용)
   */
  private showFloatingButton(position: FloatingButtonPosition): void {
    // 기존 버튼 제거
    this.hideFloatingButton();

    // Shadow Host 생성
    this.floatingButtonContainer = document.createElement('div');
    this.floatingButtonContainer.id = 'secondbrain-drag-search-button';
    this.floatingButtonContainer.style.cssText =
      'all: initial; position: fixed; z-index: 2147483647;';
    document.body.appendChild(this.floatingButtonContainer);

    // Shadow DOM 생성
    const shadowRoot = this.floatingButtonContainer.attachShadow({ mode: 'open' });

    // Tailwind CSS 주입
    const style = document.createElement('style');
    style.textContent = this.getTailwindStyles();
    shadowRoot.appendChild(style);

    // React 컨테이너 생성
    const reactContainer = document.createElement('div');
    shadowRoot.appendChild(reactContainer);

    // React 렌더링
    this.floatingButtonRoot = ReactDOM.createRoot(reactContainer);
    this.floatingButtonRoot.render(
      <FloatingSearchButton
        position={position}
        keyword={this.currentKeyword}
        onSearch={this.handleSearchClick}
        onAdd={this.handleAddClick}
        onSave={this.handleSaveClick}
        onClose={this.hideFloatingButton}
        autoHideMs={this.settings.autoHideMs}
      />,
    );
  }

  /**
   * Compact Search Popup용 CSS 스타일 (Tailwind + 다크모드)
   */
  private getCompactPopupStyles(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      }

      /* Tailwind CSS 변수 - 라이트 모드 */
      * {
        --background: oklch(0.96 0 0);
        --foreground: oklch(0.145 0 0);
        --card: oklch(0.99 0 0);
        --card-foreground: oklch(0.145 0 0);
        --primary: oklch(0.488 0.243 264.376);
        --primary-foreground: oklch(0.985 0 0);
        --muted: oklch(0.97 0 0);
        --muted-foreground: oklch(0.556 0 0);
        --accent: oklch(0.97 0 0);
        --accent-foreground: oklch(0.205 0 0);
        --border: oklch(0.922 0 0);
        --ring: oklch(0.708 0 0);
      }

      /* 다크 모드 - overlay.css와 100% 동일 */
      .dark,
      .dark * {
        --background: oklch(0.18 0 0);
        --foreground: oklch(0.985 0 0);
        --card: oklch(0.25 0 0);
        --card-foreground: oklch(0.985 0 0);
        --primary: oklch(0.922 0 0);
        --primary-foreground: oklch(0.205 0 0);
        --muted: oklch(0.35 0 0);
        --muted-foreground: oklch(0.708 0 0);
        --accent: oklch(0.35 0 0);
        --accent-foreground: oklch(0.985 0 0);
        --border: oklch(1 0 0 / 10%);
        --ring: oklch(0.556 0 0);
      }

      /* 애니메이션 */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(-10px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      /* 루트 컨테이너 */}
      .compact-popup-root {
        animation: fadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1);
      }

      /* Utility 클래스들 */
      .bg-background { background-color: var(--background); }
      .bg-card { background-color: var(--card); }
      .bg-accent { background-color: var(--accent); }
      .bg-muted { background-color: var(--muted); }
      .bg-red-50 { background-color: rgb(254, 242, 242); }

      .dark .bg-red-50 { background-color: rgb(69, 10, 10); }

      .text-foreground { color: var(--foreground); }
      .text-primary { color: var(--primary); }
      .text-muted-foreground { color: var(--muted-foreground); }
      .text-red-500 { color: rgb(239, 68, 68); }

      .text-black { color: #000; }
      .text-black\\/70 { color: #000; opacity: 0.7; }

      .dark\\:text-white { color: #000; }
      .dark .dark\\:text-white { color: #fff; }
      .dark\\:text-white\\/70 { color: #000; opacity: 0.7; }
      .dark .dark\\:text-white\\/70 { color: #fff; opacity: 0.7; }

      .font-semibold { font-weight: 600; }
      .mt-1 { margin-top: 0.25rem; }
      .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      .shrink-0 { flex-shrink: 0; }

      .border-border { border-color: var(--border); }
      .border { border-width: 1px; border-style: solid; }
      .border-2 { border-width: 2px; border-style: solid; }
      .border-b { border-bottom-width: 1px; border-style: solid; }
      .border-t { border-top-width: 1px; border-style: solid; }
      .border-border\\/50 { border-color: var(--border); opacity: 0.5; }

      .rounded-xl { border-radius: 0.75rem; }
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-md { border-radius: 0.375rem; }
      .rounded-full { border-radius: 9999px; }

      .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
      .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }

      .p-1 { padding: 0.25rem; }
      .p-2 { padding: 0.5rem; }
      .p-3 { padding: 0.75rem; }
      .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
      .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
      .py-8 { padding-top: 2rem; padding-bottom: 2rem; }

      .mt-1 { margin-top: 0.25rem; }
      .mt-2 { margin-top: 0.5rem; }
      .mt-3 { margin-top: 0.75rem; }
      .mb-3 { margin-bottom: 0.75rem; }

      .flex { display: flex; }
      .inline-block { display: inline-block; }
      .items-center { align-items: center; }
      .justify-between { justify-between: space-between; }
      .justify-center { justify-content: center; }
      .flex-col { flex-direction: column; }
      .flex-shrink-0 { flex-shrink: 0; }
      .gap-1 { gap: 0.25rem; }
      .gap-2 { gap: 0.5rem; }
      .gap-3 { gap: 0.75rem; }
      .gap-4 { gap: 1rem; }

      .w-full { width: 100%; }
      .w-\\[320px\\] { width: 320px; }
      .h-3 { height: 0.75rem; }
      .h-4 { height: 1rem; }
      .h-6 { height: 1.5rem; }
      .h-8 { height: 2rem; }
      .w-3 { width: 0.75rem; }
      .w-4 { width: 1rem; }
      .w-6 { width: 1.5rem; }
      .w-8 { width: 2rem; }
      .w-1\\.5 { width: 0.375rem; }

      .max-h-\\[280px\\] { max-height: 280px; }
      .overflow-y-auto { overflow-y: auto; }

      .flex-1 { flex: 1 1 0%; }
      .items-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .justify-end { justify-content: flex-end; }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }

      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-base { font-size: 1rem; line-height: 1.5rem; }

      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }

      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
      .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

      .leading-relaxed { line-height: 1.625; }

      .cursor-pointer { cursor: pointer; }

      .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .transition-colors { transition-property: color, background-color, border-color; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .transition-opacity { transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }

      .hover\\:bg-accent:hover { background-color: var(--accent); }
      .hover\\:text-foreground:hover { color: var(--foreground); }
      .hover\\:text-primary:hover { color: var(--primary); }
      .hover\\:border-primary:hover { border-color: var(--primary); }
      .hover\\:shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }

      .dark .hover\\:shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2); }

      /* 다크 모드 텍스트 색상 */
      .dark\\:text-white { color: #000000; }
      .dark .dark\\:text-white { color: #ffffff; }

      .opacity-0 { opacity: 0; }
      .group:hover .group-hover\\:opacity-100 { opacity: 1; }
      .group:hover .group-hover\\:text-primary { color: var(--primary); }

      button {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* 애니메이션 */
      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .animate-spin {
        animation: spin 1s linear infinite;
      }

      /* 스크롤바 현대적 디자인 */
      .scrollbar-custom::-webkit-scrollbar {
        width: 4px;
      }

      .scrollbar-custom::-webkit-scrollbar-track {
        background: transparent;
        margin: 4px 0;
      }

      .scrollbar-custom::-webkit-scrollbar-thumb {
        background-color: var(--muted);
        border-radius: 2px;
        transition: background-color 0.2s;
      }

      .scrollbar-custom::-webkit-scrollbar-thumb:hover {
        background-color: var(--muted-foreground);
      }

      .dark .scrollbar-custom::-webkit-scrollbar-thumb {
        background-color: var(--muted);
      }

      .dark .scrollbar-custom::-webkit-scrollbar-thumb:hover {
        background-color: var(--muted-foreground);
      }
    `;
  }

  /**
   * FloatingSearchButton용 Tailwind 스타일
   */
  private getTailwindStyles(): string {
    return `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      }

      .fixed { position: fixed; }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .gap-2 { gap: 0.5rem; }
      .rounded-lg { border-radius: 0.5rem; }
      .bg-white { background-color: white; }
      .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
      .hover\\:shadow-xl:hover { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .font-medium { font-weight: 500; }
      .text-gray-700 { color: rgb(55, 65, 81); }
      .text-gray-400 { color: rgb(156, 163, 175); }
      .hover\\:text-blue-600:hover { color: rgb(37, 99, 235); }
      .hover\\:text-gray-600:hover { color: rgb(75, 85, 99); }
      .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
      .duration-200 { transition-duration: 200ms; }
      .max-w-\\[200px\\] { max-width: 200px; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .flex-shrink-0 { flex-shrink: 0; }
      .cursor-pointer { cursor: pointer; }

      button {
        all: unset;
        cursor: pointer;
        display: flex;
        align-items: center;
      }

      .floating-button {
        position: fixed;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem;
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.05);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .floating-button:hover {
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }

      .action-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        color: rgb(55, 65, 81);
        transition: color 150ms, background-color 150ms;
        border-radius: 0.375rem;
      }

      .action-button:hover {
        color: rgb(37, 99, 235);
        background-color: rgb(243, 244, 246);
      }

      .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem;
        color: rgb(156, 163, 175);
        transition: color 150ms, background-color 150ms;
        border-radius: 0.375rem;
      }

      .close-button:hover {
        color: rgb(75, 85, 99);
        background-color: rgb(243, 244, 246);
      }

      .icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
    `;
  }

  /**
   * 검색 버튼 클릭 핸들러
   */
  private handleSearchClick = (): void => {
    // Background로 검색 요청
    const message: DragSearchMessage = {
      type: 'SEARCH_DRAG_TEXT',
      keyword: this.currentKeyword,
      timestamp: Date.now(),
    };

    browser.runtime.sendMessage(message).catch((error) => {
      console.error('[SecondBrain] 드래그 검색 메시지 전송 실패:', error);
    });

    this.hideFloatingButton();
  };

  /**
   * Add 버튼 클릭 핸들러
   * 드래그한 텍스트 조각을 임시 저장소에 추가
   */
  private handleAddClick = (): void => {
    void (async () => {
      try {
        // URL 유효성 검증
        if (
          !this.currentSourceUrl.startsWith('http://') &&
          !this.currentSourceUrl.startsWith('https://')
        ) {
          this.showToast('이 페이지는 추가할 수 없습니다', 'error');
          return;
        }

        // 텍스트 조각 생성
        const snippet = {
          id: crypto.randomUUID(),
          text: this.currentKeyword,
          sourceUrl: this.currentSourceUrl,
          pageTitle: this.currentPageTitle,
          timestamp: Date.now(),
        };

        // Background에 메시지 전송
        const rawResponse = await browser.runtime.sendMessage({
          type: 'ADD_TEXT_SNIPPET',
          snippet,
        });
        const response = rawResponse as {
          success: boolean;
          duplicate?: boolean;
          error?: string;
          count?: number;
        };

        if (response.success) {
          const count = response.count || 1;
          this.showToast(`임시 노트에 추가됨 (총 ${count}개)`, 'success');
        } else if (response.duplicate) {
          this.showToast('이미 추가된 텍스트입니다', 'info');
        } else {
          this.showToast('추가 실패', 'error');
        }

        this.hideFloatingButton();
      } catch (error) {
        console.error('[DragSearchManager] Add failed:', error);
        this.showToast('추가 실패', 'error');
      }
    })();
  };

  /**
   * Save 버튼 클릭 핸들러
   * 드래그한 텍스트 + URL을 백엔드로 즉시 전송
   */
  private handleSaveClick = (): void => {
    void (async () => {
      try {
        // 텍스트 + 메타데이터 포맷팅
        const formattedData = this.formatTextWithMetadata(
          this.currentKeyword,
          this.currentSourceUrl,
          this.currentPageTitle,
        );

        const batchId = `batch_${Date.now()}`;
        const batchTimestamp = Date.now();

        // Background Service Worker에 저장 요청
        const rawSaveResponse = await browser.runtime.sendMessage({
          type: 'SAVE_CURRENT_PAGE',
          urls: [formattedData],
          batchId,
          batchTimestamp,
        });
        const response = rawSaveResponse as { success?: boolean; error?: string; message?: string };

        if ('error' in response && response.error) {
          this.showToast(`저장 실패: ${this.getErrorMessage(response.error)}`, 'error');
        } else {
          this.showToast('저장되었습니다', 'success');
        }

        this.hideFloatingButton();
      } catch (error) {
        console.error('[DragSearchManager] Save failed:', error);
        this.showToast('저장 실패', 'error');
      }
    })();
  };

  /**
   * 텍스트 + 메타데이터 포맷팅
   */
  private formatTextWithMetadata(text: string, url: string, title: string): string {
    return `=== 출처 정보 ===
URL: ${url}
제목: ${title}
추가 시간: ${new Date().toLocaleString('ko-KR')}

=== 선택된 텍스트 ===
${text}`;
  }

  /**
   * 토스트 메시지 표시
   */
  private showToast(message: string, type: 'success' | 'error' | 'info'): void {
    // SimpleToast 컴포넌트 사용을 위해 window.postMessage 사용
    window.postMessage(
      {
        type: 'SHOW_TOAST',
        message,
        toastType: type,
      },
      '*',
    );
  }

  /**
   * 에러 코드 → 사용자 친화적 메시지
   */
  private getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      NO_TOKEN: '로그인이 필요합니다',
      INVALID_URL: '이 페이지는 저장할 수 없습니다',
      API_ERROR: 'API 오류가 발생했습니다',
      NETWORK_ERROR: '네트워크 연결을 확인해주세요',
      UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다',
    };
    return errorMessages[errorCode] || errorMessages['UNKNOWN_ERROR'];
  }

  /**
   * 플로팅 버튼 숨기기
   */
  private hideFloatingButton = (): void => {
    if (this.floatingButtonRoot) {
      this.floatingButtonRoot.unmount();
      this.floatingButtonRoot = null;
    }
    if (this.floatingButtonContainer) {
      this.floatingButtonContainer.remove();
      this.floatingButtonContainer = null;
    }
  };

  /**
   * Background로부터 검색 결과 수신
   */
  private handleBackgroundMessage = (message: unknown): void | boolean => {
    const response = message as DragSearchResponse;

    if (response.type === 'DRAG_SEARCH_RESULT') {
      // Compact Popup 표시 (드래그 위치 근처)
      this.showCompactSearchPopup(
        response.keyword,
        response.results || [],
        response.totalCount || 0,
        false,
        null,
      );
      return;
    } else if (response.type === 'DRAG_SEARCH_ERROR') {
      // 에러를 Compact Popup으로 표시
      this.showCompactSearchPopup(response.keyword, [], 0, false, response.error || null);
      return;
    }

    return;
  };

  /**
   * Compact Search Popup 표시 (Shadow DOM)
   */
  private showCompactSearchPopup(
    keyword: string,
    results: NoteSearchResult[],
    totalCount: number,
    isLoading: boolean,
    error: string | null,
  ): void {
    // 기존 popup 제거
    this.hideCompactSearchPopup();

    // Viewport 위치 계산
    const position = this.calculatePopupPosition(this.currentDragPosition, 320, 400);

    // Shadow Host 생성
    this.compactPopupContainer = document.createElement('div');
    this.compactPopupContainer.id = 'secondbrain-compact-search-popup';
    this.compactPopupContainer.style.cssText = `
      all: initial;
      position: fixed;
      left: ${position.left}px;
      top: ${position.top}px;
      z-index: 2147483647;
    `;
    document.body.appendChild(this.compactPopupContainer);

    // Shadow DOM 생성
    const shadowRoot = this.compactPopupContainer.attachShadow({ mode: 'open' });

    // CSS 주입
    const style = document.createElement('style');
    style.textContent = this.getCompactPopupStyles();
    shadowRoot.appendChild(style);

    // React 컨테이너
    const reactContainer = document.createElement('div');
    shadowRoot.appendChild(reactContainer);

    // React 렌더링
    this.compactPopupRoot = ReactDOM.createRoot(reactContainer);
    this.compactPopupRoot.render(
      <CompactSearchPopup
        position={this.currentDragPosition}
        keyword={keyword}
        results={results}
        totalCount={totalCount}
        isLoading={isLoading}
        error={error}
        onViewAll={this.handleViewAll}
        onClose={this.hideCompactSearchPopup}
      />,
    );
  }

  /**
   * Compact Popup 숨기기
   */
  private hideCompactSearchPopup = (): void => {
    if (this.compactPopupRoot) {
      this.compactPopupRoot.unmount();
      this.compactPopupRoot = null;
    }
    if (this.compactPopupContainer) {
      this.compactPopupContainer.remove();
      this.compactPopupContainer = null;
    }
  };

  /**
   * 전체 보기 클릭 핸들러
   */
  private handleViewAll = (): void => {
    this.hideCompactSearchPopup();

    // Overlay 열기 + DragSearchPanel 표시
    window.postMessage(
      {
        type: 'SECONDBRAIN_OPEN_OVERLAY_WITH_SEARCH',
      },
      '*',
    );
  };

  /**
   * Popup 위치 계산 (viewport 경계 체크)
   */
  private calculatePopupPosition(
    dragPos: FloatingButtonPosition,
    width: number,
    height: number,
  ): { left: number; top: number } {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 20; // 화면 가장자리 여백

    let left = dragPos.x;
    let top = dragPos.y + 10; // 드래그 위치 아래

    // 오른쪽 경계 체크
    if (left + width > viewportWidth - padding) {
      left = viewportWidth - width - padding;
    }

    // 하단 경계 체크
    if (top + height > viewportHeight - padding) {
      top = dragPos.y - height - 10; // 위로 표시
    }

    // 상단 경계 체크
    if (top < padding) {
      top = padding;
    }

    // 왼쪽 경계 체크
    if (left < padding) {
      left = padding;
    }

    return { left, top };
  }

  /**
   * Storage 변경 감지 (설정 업데이트)
   */
  private handleStorageChange = (
    changes: Record<string, browser.Storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName === 'local' && changes.dragSearchSettings) {
      const newSettings = changes.dragSearchSettings.newValue as DragSearchSettings | undefined;
      if (newSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...newSettings };
        this.listener?.updateSettings(this.settings);
      }
    }
  };

  /**
   * Cleanup
   */
  destroy(): void {
    this.listener?.destroy();
    this.hideFloatingButton();
    this.hideCompactSearchPopup();
    browser.runtime.onMessage.removeListener(this.handleBackgroundMessage);
    browser.storage.onChanged.removeListener(this.handleStorageChange);
  }
}

// 초기화 실행
const manager = new DragSearchManager();
manager.initialize().catch((error) => {
  console.error('[SecondBrain] 드래그 검색 초기화 실패:', error);
});

// Hot Module Replacement 지원 (개발 환경)
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    manager.destroy();
  });
}
