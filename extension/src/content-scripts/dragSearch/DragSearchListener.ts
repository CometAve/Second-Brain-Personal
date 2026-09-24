import { debounce } from '@/lib/utils/debounce';
import type { DragSearchSettings, FloatingButtonPosition } from '@/types/dragSearch';

/**
 * 드래그 텍스트 검색 이벤트 리스너
 * 웹페이지에서 텍스트 드래그 감지 및 검증 처리
 */
export class DragSearchListener {
  private settings: DragSearchSettings;
  private skipNextSearch = false;
  private lastSearchKeyword = '';
  private debouncedSearch: (keyword: string, position: FloatingButtonPosition) => void;

  private onDragSearchCallback: (keyword: string, position: FloatingButtonPosition) => void;

  constructor(
    settings: DragSearchSettings,
    onDragSearch: (keyword: string, position: FloatingButtonPosition) => void,
  ) {
    this.settings = settings;
    this.onDragSearchCallback = onDragSearch;
    this.debouncedSearch = debounce(
      ((keyword: string, position: FloatingButtonPosition) => {
        this.onDragSearchCallback(keyword, position);
      }) as (...args: unknown[]) => void,
      settings.debounceMs,
    );
    this.initialize();
  }

  /**
   * 이벤트 리스너 초기화
   */
  private initialize(): void {
    // Ctrl+C/Cmd+C 감지 (복사 시 검색 스킵)
    document.addEventListener('keydown', this.handleKeyDown);

    // 드래그 종료 감지
    document.addEventListener('mouseup', this.handleMouseUp);

    // 패스워드 필드 감지용 (보안)
    document.addEventListener('focusin', this.handleFocusIn);
  }

  /**
   * 키보드 이벤트 핸들러
   * Ctrl+C/Cmd+C 감지 시 다음 검색 스킵
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      this.skipNextSearch = true;
      setTimeout(() => {
        this.skipNextSearch = false;
      }, 100);
    }
  };

  /**
   * 마우스 업 이벤트 핸들러
   * 드래그 종료 시 텍스트 추출 및 검증
   */
  private handleMouseUp = (e: MouseEvent): void => {
    // 검색 비활성화 상태 체크
    if (!this.settings.enabled) return;
    if (this.skipNextSearch) return;

    // Chrome Extension 페이지에서는 작동 안 함
    const currentUrl = window.location.href;
    if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://')) {
      return;
    }

    // Extension Overlay UI 내부에서는 작동 안 함
    const target = e.target as HTMLElement;
    if (
      target?.closest('#secondbrain-extension-container') ||
      target?.closest('#secondbrain-extension-root')
    ) {
      return;
    }

    // 선택된 텍스트 추출
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    // 검증 조건
    if (!selectedText) return;
    if (selectedText.length < this.settings.minTextLength) return;
    if (selectedText === this.lastSearchKeyword) return; // 중복 방지

    // 패스워드 필드 체크 (보안)
    if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') {
      return;
    }

    // 제외 도메인 체크 (양방향 매칭)
    const currentDomain = window.location.hostname;
    const isExcluded = this.settings.excludedDomains.some((domain) => {
      // 양방향 매칭: "velog.io"가 "www.velog.io"를 포함하거나, 그 반대
      return currentDomain.includes(domain) || domain.includes(currentDomain);
    });

    if (isExcluded) {
      return;
    }

    // 마우스 위치 저장 (플로팅 버튼 표시용)
    const position: FloatingButtonPosition = { x: e.clientX, y: e.clientY };

    this.lastSearchKeyword = selectedText;
    this.debouncedSearch(selectedText, position);
  };

  /**
   * 포커스 이벤트 핸들러
   * 패스워드 필드 포커스 시 검색 비활성화
   */
  private handleFocusIn = (e: FocusEvent): void => {
    const target = e.target as HTMLElement;
    if (target?.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') {
      this.skipNextSearch = true;
    }
  };

  /**
   * 이벤트 리스너 제거 (cleanup)
   */
  public destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('focusin', this.handleFocusIn);
  }

  /**
   * 설정 업데이트
   */
  public updateSettings(newSettings: Partial<DragSearchSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.debounceMs) {
      this.debouncedSearch = debounce(
        ((keyword: string, position: FloatingButtonPosition) => {
          this.onDragSearchCallback(keyword, position);
        }) as (...args: unknown[]) => void,
        newSettings.debounceMs,
      );
    }
  }
}
