import browser from 'webextension-polyfill';
import { exchangeGoogleToken, logout as logoutService } from '@/services/authService';
import { getCurrentUser } from '@/services/userService';
import { saveCurrentPageWithStoredToken } from '@/services/noteService';
import { handleDragSearchMessage } from './dragSearchHandler';
import { env } from '@/config/env';
import * as storage from '@/services/storageService';
import type { UserInfo } from '@/types/auth';
import type { SavePageResponse, SavePageError } from '@/types/note';
import type { DragSearchMessage } from '@/types/dragSearch';
import type { AddTextSnippetMessage, AddTextSnippetResponse } from '@/types/pendingTextSnippet';

/**
 * Background Service Worker
 * - 확장프로그램 아이콘 클릭 이벤트 처리
 * - Content Script와 메시지 통신
 * - 웹앱 쿠키 기반 인증 관리
 */

// 메시지 타입 정의
type ExtensionMessage =
  | { type: 'CHECK_AUTH' }
  | { type: 'LOGIN' }
  | { type: 'LOGOUT' }
  | { type: 'OPEN_TAB'; url: string }
  | { type: 'OPEN_SIDE_PANEL'; noteId: number; windowId: number }
  | { type: 'AUTH_CHANGED' }
  | { type: 'ADD_PAGE_TO_COLLECTION'; url: string }
  | AddTextSnippetMessage
  | {
      type: 'SAVE_CURRENT_PAGE';
      url?: string;
      urls?: string[];
      batchId?: string;
      batchTimestamp?: number;
    }
  | DragSearchMessage;

interface AuthResponse {
  authenticated: boolean;
  user?: UserInfo;
}

interface AddPageResponse {
  success: boolean;
  duplicate?: boolean;
  error?: string;
}

// chrome.storage에서 인증 상태 확인
async function checkAuth(): Promise<AuthResponse> {
  try {
    const result = await browser.storage.local.get(['authenticated', 'user']);

    if (result.authenticated) {
      return {
        authenticated: true,
        user: result.user as UserInfo | undefined,
      };
    }

    return { authenticated: false };
  } catch (error) {
    console.error('checkAuth failed:', error);
    return { authenticated: false };
  }
}

// 중복 로그인 방지 플래그
let isLoginInProgress = false;

/**
 * 모든 탭에 메시지 브로드캐스트
 * @param message 전송할 메시지
 */
async function broadcastToAllTabs(message: unknown): Promise<void> {
  try {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        try {
          await browser.tabs.sendMessage(tab.id, message);
        } catch {
          // Content script가 없는 탭은 무시
        }
      }
    }
  } catch (error) {
    console.error('Failed to broadcast message:', error);
  }
}

/**
 * 새 탭에서 Google OAuth 인증 처리
 *
 * Flow:
 * 1. chrome.tabs.create()로 OAuth URL을 새 탭에서 열기
 * 2. chrome.tabs.onUpdated로 redirect_uri 감지
 * 3. authorization code 추출
 * 4. chrome.tabs.remove()로 탭 자동 닫기
 *
 * @param authUrl - Google OAuth authorization URL
 * @param redirectUri - Extension redirect URI
 * @returns Promise<string> - authorization code
 * @throws Error - OAuth 취소, 타임아웃, 코드 없음 등
 */
async function handleLoginWithTab(authUrl: string, redirectUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. 새 탭 생성
    chrome.tabs.create({ url: authUrl, active: true }, (createdTab) => {
      if (!createdTab.id) {
        reject(new Error('Failed to create OAuth tab'));
        return;
      }

      const tabId = createdTab.id;
      let isResolved = false; // 중복 처리 방지 플래그

      // 2. 타임아웃 설정 (5분)
      const timeout = setTimeout(
        () => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            chrome.tabs.remove(tabId).catch(() => {
              // 탭이 이미 닫혔을 수 있음
            });
            reject(new Error('OAuth authentication timeout (5 minutes)'));
          }
        },
        5 * 60 * 1000,
      );

      // 3. 탭 URL 업데이트 감지
      const updateListener = (updatedTabId: number, changeInfo: { url?: string }) => {
        // 생성한 탭만 처리
        if (updatedTabId !== tabId || isResolved) return;

        // URL이 존재하고 string 타입인지 확인
        const urlValue = changeInfo.url;
        if (!urlValue || typeof urlValue !== 'string') return;

        const changedUrl: string = urlValue;

        if (changedUrl.startsWith(redirectUri)) {
          isResolved = true;
          clearTimeout(timeout);

          try {
            // Authorization code 추출
            const callbackUrl = new URL(changedUrl);
            const code = callbackUrl.searchParams.get('code');
            const oauthError = callbackUrl.searchParams.get('error');

            // 탭 닫기
            chrome.tabs.remove(tabId).catch(() => {
              // 탭이 이미 닫혔을 수 있음
            });
            cleanup();

            // 에러 처리
            if (oauthError) {
              const errorDescription =
                callbackUrl.searchParams.get('error_description') || oauthError;
              reject(new Error(`OAuth error: ${errorDescription}`));
            } else if (code) {
              resolve(code);
            } else {
              reject(new Error('No authorization code found in callback URL'));
            }
          } catch (parseError) {
            cleanup();
            const errorMessage =
              parseError instanceof Error ? parseError.message : String(parseError);
            reject(new Error(`Failed to parse callback URL: ${errorMessage}`));
          }
        }
      };

      // 4. 탭 닫힘 감지 (사용자가 수동으로 닫은 경우)
      const removeListener = (removedTabId: number) => {
        if (removedTabId === tabId && !isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          cleanup();
          reject(new Error('User cancelled OAuth by closing the tab'));
        }
      };

      // 5. 리스너 정리 함수
      const cleanup = () => {
        chrome.tabs.onUpdated.removeListener(updateListener);
        chrome.tabs.onRemoved.removeListener(removeListener);
      };

      // 6. 리스너 등록
      chrome.tabs.onUpdated.addListener(updateListener);
      chrome.tabs.onRemoved.addListener(removeListener);
    });
  });
}

/**
 * OAuth 로그인 처리 (새 탭 방식)
 *
 * Flow:
 * 1. chrome.identity.getRedirectURL()로 Extension redirect URI 획득
 * 2. Google OAuth URL 직접 생성 (백엔드 거치지 않음!)
 * 3. chrome.tabs.create()로 OAuth를 새 탭에서 실행
 * 4. Authorization code 추출 (탭 자동 닫기)
 * 5. 백엔드 API로 code 전송하여 JWT 토큰 교환
 * 6. 사용자 정보 조회 및 저장
 */
async function handleLogin(): Promise<void> {
  // 중복 로그인 방지
  if (isLoginInProgress) {
    console.warn('⚠️ OAuth login already in progress');
    return;
  }

  isLoginInProgress = true;
  // 모든 Extension 탭에 인증 상태 변경 알림
  const notifyAuthChanged = async () => {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        try {
          await browser.tabs.sendMessage(tab.id, { type: 'AUTH_CHANGED' });
        } catch {
          // Content script 없는 탭 무시
        }
      }
    }
  };

  try {
    // 1. Extension Redirect URI 가져오기
    const redirectUri = chrome.identity.getRedirectURL();

    // 2. Google OAuth URL 직접 생성 (백엔드 거치지 않음!)
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', env.googleClientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    // 3. 새 탭에서 OAuth 실행
    const code = await handleLoginWithTab(googleAuthUrl.toString(), redirectUri);

    // 4. Authorization Code 검증
    if (!code) {
      console.error('❌ No authorization code received');
      throw new Error('OAuth callback did not contain authorization code.');
    }

    // 5. Google Authorization Code를 Backend JWT로 교환
    const tokenData = await exchangeGoogleToken(code, redirectUri);

    if (!tokenData.success || !tokenData.data) {
      console.error('❌ Token exchange failed:', tokenData);
      throw new Error('Token exchange returned invalid data');
    }

    const { accessToken } = tokenData.data;

    // 6. Access Token 저장 (getCurrentUser가 이 토큰을 사용함)
    await browser.storage.local.set({
      access_token: accessToken,
    });

    // 7. 사용자 정보 조회
    try {
      const userInfo = await getCurrentUser();

      // 8. 최종 인증 상태 저장
      await browser.storage.local.set({
        authenticated: true,
        user: userInfo,
      });

      // 9. 모든 탭에 인증 변경 알림
      await notifyAuthChanged();
    } catch (userError) {
      // 사용자 정보 조회 실패 시 정리
      console.error('❌ Failed to fetch user info:', userError);
      await browser.storage.local.remove(['access_token', 'authenticated', 'user']);
      throw new Error('Failed to fetch user information after successful login', {
        cause: userError,
      });
    }
  } catch (error) {
    // OAuth 전체 실패 처리
    console.error('❌ OAuth login failed:', error);
    throw error;
  } finally {
    // 항상 플래그 해제
    isLoginInProgress = false;
  }
}

// 확장프로그램 아이콘 클릭 이벤트
browser.action.onClicked.addListener((tab) => {
  const tabId = tab.id;
  const tabUrl = tab.url;

  if (!tabId || !tabUrl) return;

  // 시스템 페이지에서는 작동하지 않음
  if (!tabUrl.startsWith('http://') && !tabUrl.startsWith('https://')) {
    return;
  }

  void (async () => {
    try {
      // 1단계: Content Script가 준비되었는지 확인 (PING)
      try {
        await browser.tabs.sendMessage(tabId, { type: 'PING' });
      } catch {
        // Content script가 없으면 동적으로 주입
        try {
          await browser.scripting.executeScript({
            target: { tabId },
            files: ['src/content-scripts/overlay/overlay-entry.tsx'],
          });
          // 주입 후 잠시 대기
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (injectError) {
          console.error('Failed to inject content script:', injectError);
          return;
        }
      }

      // 2단계: Content Script에 overlay toggle 메시지 전송
      await browser.tabs.sendMessage(tabId, { type: 'TOGGLE_OVERLAY' });
    } catch (error) {
      console.error('Failed to send message to content script:', error);
    }
  })();
});

// Content Script로부터 메시지 수신
browser.runtime.onMessage.addListener(
  (
    message: unknown,
    sender: browser.Runtime.MessageSender,
    sendResponse: (
      response:
        | AuthResponse
        | AddPageResponse
        | AddTextSnippetResponse
        | { success: boolean; error?: string }
        | SavePageResponse
        | SavePageError,
    ) => void,
  ) => {
    const msg = message as ExtensionMessage;

    // OPEN_SIDE_PANEL은 동기적으로 처리해야 user gesture가 유지됨
    if (msg.type === 'OPEN_SIDE_PANEL') {
      const { noteId } = msg;
      const tabId = sender.tab?.id;

      // 1. Storage에 noteId 저장 (비동기지만 sidePanel.open 전에 시작)
      void browser.storage.local.set({ currentNoteId: noteId });

      // 2. Side Panel 동기적으로 열기 (await 없이!)
      if ('sidePanel' in chrome && typeof chrome.sidePanel.open === 'function') {
        if (tabId) {
          chrome.sidePanel
            .open({ tabId })
            .then(() => {
              sendResponse({ success: true });
            })
            .catch((error) => {
              console.warn('[ServiceWorker] sidePanel.open() failed:', error);
              sendResponse({ success: false, error: 'SIDE_PANEL_OPEN_FAILED' });
            });
        } else {
          sendResponse({ success: false, error: 'NO_TAB_ID' });
        }
      } else {
        sendResponse({ success: false, error: 'SIDE_PANEL_NOT_SUPPORTED' });
      }
      return true; // 비동기 응답
    }

    void (async () => {
      try {
        // 드래그 검색 메시지 처리 (별도 핸들러)
        // fire-and-forget: Background가 browser.tabs.sendMessage로 별도 응답
        if (msg.type === 'SEARCH_DRAG_TEXT') {
          // 즉시 응답하여 메시지 채널 정상 종료
          sendResponse({ success: true });
          // 비동기 처리는 별도로 진행 (browser.tabs.sendMessage로 결과 전송)
          void handleDragSearchMessage(msg, sender);
          return;
        }

        switch (msg.type) {
          case 'CHECK_AUTH': {
            const authResponse = await checkAuth();
            sendResponse(authResponse);
            break;
          }

          case 'ADD_PAGE_TO_COLLECTION': {
            try {
              // pageCollectionStore 대신 storage 직접 접근
              const pages = await storage.loadCollectedPages();

              // 중복 체크
              if (pages.includes(msg.url)) {
                sendResponse({ success: false, duplicate: true });
                break;
              }

              // 추가
              await storage.addCollectedPage(msg.url);

              // 성공 응답
              sendResponse({ success: true, duplicate: false });
            } catch (error) {
              console.error('ADD_PAGE_TO_COLLECTION failed:', error);
              sendResponse({ success: false, error: 'Failed to add page' });
            }
            break;
          }

          case 'ADD_TEXT_SNIPPET': {
            try {
              const snippets = await storage.loadPendingSnippets();

              // 중복 체크 (텍스트 + URL 기반)
              const duplicate = snippets.some(
                (s) => s.text === msg.snippet.text && s.sourceUrl === msg.snippet.sourceUrl,
              );

              if (duplicate) {
                sendResponse({ success: false, duplicate: true, count: snippets.length });
                break;
              }

              // 추가
              const updated = await storage.addPendingSnippet(msg.snippet);

              // 성공 응답
              sendResponse({ success: true, duplicate: false, count: updated.length });
            } catch (error) {
              console.error('ADD_TEXT_SNIPPET failed:', error);
              sendResponse({ success: false, error: 'Failed to add text snippet' });
            }
            break;
          }

          case 'LOGIN': {
            // 백그라운드에서 로그인 처리 (즉시 응답 반환)
            void handleLogin().catch(() => {
              // 에러를 조용히 처리 (이미 console.error에서 로그됨)
              // 사용자 취소 등은 정상 동작이므로 UI에 영향 없음
            });
            sendResponse({ success: true });
            break;
          }

          case 'LOGOUT': {
            try {
              // 백엔드 로그아웃 API 호출 (Refresh Token 무효화)
              await logoutService();
            } catch (error) {
              console.error('Backend logout failed:', error);
              // 백엔드 로그아웃 실패해도 클라이언트 측 로그아웃은 진행
            }

            // chrome.storage에서 인증 정보 삭제
            await browser.storage.local.remove([
              'access_token',
              'refresh_token',
              'user',
              'authenticated',
            ]);

            // 모든 탭에 인증 상태 변경 알림
            await broadcastToAllTabs({ type: 'AUTH_CHANGED' });

            sendResponse({ success: true });
            break;
          }

          case 'OPEN_TAB': {
            // 새 탭에서 URL 열기
            await browser.tabs.create({ url: msg.url });
            sendResponse({ success: true });
            break;
          }

          // OPEN_SIDE_PANEL은 상단에서 동기적으로 처리됨

          case 'SAVE_CURRENT_PAGE': {
            try {
              let urlsToSave: string[];

              // 1순위: urls 배열이 전달된 경우 (여러 페이지)
              if (msg.urls && msg.urls.length > 0) {
                urlsToSave = msg.urls;
              }
              // 2순위: 단일 URL (url 필드)
              else if (msg.url) {
                urlsToSave = [msg.url];
              }
              // 3순위: sender.tab.url
              else if (sender.tab?.url) {
                urlsToSave = [sender.tab.url];
              }
              // 4순위: Fallback - 현재 활성 탭 조회
              else {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                const currentTab = tabs[0];

                if (!currentTab || !currentTab.url) {
                  const error: SavePageError = {
                    error: 'NO_TAB',
                    message: 'Could not find current tab URL',
                  };
                  sendResponse(error);
                  break;
                }
                urlsToSave = [currentTab.url];
              }

              // URL 유효성 검증 및 필터링
              const validUrls = urlsToSave.filter((url) => {
                if (!url || url.trim() === '') return false;
                // URL 또는 메타데이터 포맷된 텍스트 허용
                if (url.startsWith('http://') || url.startsWith('https://')) return true;
                if (url.includes('=== 출처 정보 ===')) return true; // 메타데이터 포맷
                return false;
              });

              if (validUrls.length === 0) {
                console.error('❌ No valid URLs to save');
                const error: SavePageError = {
                  error: 'INVALID_URL',
                  message: 'No valid URLs to save',
                };
                sendResponse(error);
                break;
              }

              // batchId 및 timestamp (Content Script에서 전달되거나 새로 생성)
              const batchId = msg.batchId || `batch_${Date.now()}`;
              const batchTimestamp = msg.batchTimestamp || Date.now();

              // 1. 모든 탭에 "저장 시작" 브로드캐스트
              await broadcastToAllTabs({
                type: 'SAVE_STATUS_STARTED',
                urls: validUrls,
                batchId,
                batchTimestamp,
              });

              // 2. Note Service 호출 (토큰 자동 획득)
              const response = await saveCurrentPageWithStoredToken(validUrls);

              // 3. 모든 탭에 "저장 완료" 브로드캐스트
              await broadcastToAllTabs({
                type: 'SAVE_STATUS_COMPLETED',
                urls: validUrls,
                batchId,
                success: !('error' in response),
                error: 'error' in response ? response.error : undefined,
              });

              // 4. 요청한 탭에 응답
              sendResponse(response);
            } catch (error) {
              // 5. 에러 응답
              console.error('SAVE_CURRENT_PAGE failed:', error);

              // SavePageError 타입 검증
              if (error && typeof error === 'object' && 'error' in error) {
                sendResponse(error as SavePageError);
              } else {
                const unknownError: SavePageError = {
                  error: 'UNKNOWN_ERROR',
                  message: error instanceof Error ? error.message : 'Unknown error',
                };
                sendResponse(unknownError);
              }
            }
            break;
          }

          default:
            sendResponse({ success: false });
        }
      } catch (error) {
        console.error('Message handler error:', error);
        sendResponse({ authenticated: false });
      }
    })();

    // 비동기 응답을 위해 true 반환
    return true;
  },
);
