import { create } from 'zustand';

import type { UserInfo } from '@/features/auth/types/auth';
import { useGraphStore } from '@/features/main/stores/graphStore';
import { useSearchPanelStore } from '@/features/main/stores/searchPanelStore';
import { queryClient } from '@/lib/queryClient';

function clearPrivateClientState(): void {
  queryClient.clear();
  useSearchPanelStore.getState().reset();
  useGraphStore.getState().resumeGraph();
}

export class StaleSessionError extends Error {
  constructor() {
    super('Session changed while the request was in progress');
    this.name = 'StaleSessionError';
  }
}

/**
 * 인증 스토어 상태 인터페이스
 */
interface AuthStore {
  accessToken: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  sessionEpoch: number;
  beginSession: () => number;
  setAccessToken: (token: string) => void;
  setUser: (user: UserInfo) => void;
  completeSession: (epoch: number, token: string, user: UserInfo) => void;
  clearAuth: () => void;
}

/**
 * 인증 상태 관리 Zustand 스토어
 * - accessToken: 메모리에 저장 (XSS 방어)
 * - user: 현재 로그인된 사용자 정보
 * - isAuthenticated: 로그인 여부
 */
export const useAuthStore = create<AuthStore>()((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  sessionEpoch: 0,

  beginSession: () => {
    clearPrivateClientState();
    const nextEpoch = get().sessionEpoch + 1;
    set({ accessToken: null, user: null, isAuthenticated: false, sessionEpoch: nextEpoch });
    return nextEpoch;
  },
  setAccessToken: (token) =>
    set((state) => ({ accessToken: token, isAuthenticated: Boolean(token && state.user) })),

  setUser: (user) =>
    set((state) => ({ user, isAuthenticated: Boolean(state.accessToken && user) })),

  completeSession: (epoch, token, user) => {
    assertCurrentSession(epoch);
    set({ accessToken: token, user, isAuthenticated: true });
  },

  clearAuth: () => {
    clearPrivateClientState();
    set((state) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      sessionEpoch: state.sessionEpoch + 1,
    }));
  },
}));

/** Capture when private work is scheduled, before Axios dispatches. */
export function captureSessionEpoch(): number {
  return useAuthStore.getState().sessionEpoch;
}

export function isCurrentSession(epoch: number): boolean {
  return useAuthStore.getState().sessionEpoch === epoch;
}

export function assertCurrentSession(epoch: number): void {
  if (!isCurrentSession(epoch)) throw new StaleSessionError();
}
