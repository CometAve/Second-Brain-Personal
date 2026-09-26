import { ExtensionOverlay } from '@/content-scripts/overlay/components/organisms/ExtensionOverlay';
import { ThemeProvider } from '@/contexts/ThemeProvider';
import { ShadowRootProvider } from '@/contexts/ShadowRootProvider';
import { SimpleToastContainer } from '@/content-scripts/overlay/components/molecules/SimpleToast';
import { useEffect } from 'react';
import { useDragSearchStore } from '@/stores/dragSearchStore';
import { useSaveStatusStore } from '@/stores/saveStatusStore';
import type { NoteSearchResult } from '@/types/note';

/**
 * Shadow DOM 내부에 렌더링되는 React 루트 컴포넌트
 * - ShadowRootProvider로 Shadow Root 컨텍스트 제공
 * - ThemeProvider로 전체 앱을 감싸서 Light/Dark 모드 지원
 * - ExtensionOverlay를 렌더링
 * - Animation keyframes 주입
 */

interface OverlayRootProps {
  isOpen: boolean;
  onToggle: (visible: boolean) => void;
  shadowRoot: ShadowRoot | HTMLElement;
}

export function OverlayRoot({ isOpen, onToggle, shadowRoot }: OverlayRootProps) {
  const { setSearchResults, setError, loadHistory } = useDragSearchStore();
  const { addSaveRequestsFromBroadcast, updateSaveStatusByUrls } = useSaveStatusStore.getState();

  // Inject animation keyframes into Shadow DOM
  useEffect(() => {
    if (shadowRoot instanceof ShadowRoot) {
      const styleId = 'overlay-animations';
      if (!shadowRoot.querySelector(`#${styleId}`)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.8;
            }
          }
        `;
        shadowRoot.appendChild(style);
      }
    }
  }, [shadowRoot]);

  // 드래그 검색 메시지 리스너 + 저장 진행상황 브로드캐스트 리스너
  useEffect(() => {
    const handleMessage = (
      event: MessageEvent<{
        type: string;
        payload?: { keyword?: string; results?: unknown; totalCount?: number; error?: string };
        urls?: string[];
        batchId?: string;
        batchTimestamp?: number;
        success?: boolean;
        error?: string;
      }>,
    ) => {
      // dragSearchStore에 결과 저장 (Compact Popup과 Overlay 공유)
      if (event.data?.type === 'SECONDBRAIN_SAVE_SEARCH_RESULT' && event.data.payload) {
        const { keyword, results, totalCount } = event.data.payload;
        if (keyword && Array.isArray(results) && typeof totalCount === 'number') {
          setSearchResults(keyword, results as NoteSearchResult[], totalCount);
        }
      }
      // Compact Popup에서 "전체 보기" 클릭 시
      else if (event.data?.type === 'SECONDBRAIN_OPEN_OVERLAY_WITH_SEARCH') {
        // Overlay 열기 (검색 결과는 이미 store에 저장됨)
        if (!isOpen) {
          onToggle(true);
        }
      }
      // 기존 로직 (deprecated, Compact Popup으로 대체됨)
      else if (event.data?.type === 'SECONDBRAIN_DRAG_SEARCH_RESULT' && event.data.payload) {
        const { keyword, results, totalCount } = event.data.payload;
        if (keyword && Array.isArray(results) && typeof totalCount === 'number') {
          setSearchResults(keyword, results as NoteSearchResult[], totalCount);

          // Overlay 자동 열기
          if (!isOpen) {
            onToggle(true);
          }
        }
      } else if (event.data?.type === 'SECONDBRAIN_DRAG_SEARCH_ERROR' && event.data.payload) {
        const { keyword, error } = event.data.payload;
        if (keyword && error) {
          setError(`"${keyword}" 검색 실패: ${error}`);

          // Overlay 자동 열기
          if (!isOpen) {
            onToggle(true);
          }
        }
      }
      // 저장 시작 브로드캐스트 (다른 탭에서 Save 클릭)
      else if (event.data?.type === 'SAVE_STATUS_STARTED') {
        const { urls, batchId, batchTimestamp } = event.data;
        if (urls && batchId && batchTimestamp) {
          addSaveRequestsFromBroadcast(urls, batchId, batchTimestamp);
        }
      }
      // 저장 완료 브로드캐스트
      else if (event.data?.type === 'SAVE_STATUS_COMPLETED') {
        const { urls, batchId, success, error } = event.data;
        if (urls && batchId && typeof success === 'boolean') {
          updateSaveStatusByUrls(urls, batchId, success, error);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [
    addSaveRequestsFromBroadcast,
    isOpen,
    onToggle,
    setError,
    setSearchResults,
    updateSaveStatusByUrls,
  ]);

  // 히스토리 로드 (분리된 Effect)
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <ShadowRootProvider shadowRoot={shadowRoot}>
      <ThemeProvider>
        <ExtensionOverlay isOpen={isOpen} onToggle={onToggle} />
        <SimpleToastContainer />
      </ThemeProvider>
    </ShadowRootProvider>
  );
}
