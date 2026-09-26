import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { env } from '@/config/env';
import { parseTokenResponse, parseUserResponse } from '@/features/auth/schemas/authSchemas';
import {
  assertCurrentSession,
  isCurrentSession,
  StaleSessionError,
  useAuthStore,
} from '@/stores/authStore';

function assertRequestEpoch(config: InternalAxiosRequestConfig): number {
  if (config.sessionEpoch === undefined) {
    throw new Error('Session epoch required for API request');
  }
  assertCurrentSession(config.sessionEpoch);
  return config.sessionEpoch;
}

function isAnonymousAuthRequest(url: string | undefined): boolean {
  return url === '/api/auth/token' || url === '/api/auth/refresh';
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('API request failed');
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  assertRequestEpoch(config);
  if (!isAnonymousAuthRequest(config.url)) {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: { epoch: number; promise: Promise<string> } | null = null;

// No refresh interceptor here: checking the freshly issued token must never recurse.
const identityClient = axios.create({
  baseURL: env.apiBaseUrl,
  withCredentials: true,
  timeout: 10000,
});
identityClient.interceptors.request.use((config) => {
  assertRequestEpoch(config);
  return config;
});

export class SessionIdentityChangedError extends Error {
  constructor() {
    super('Session identity changed during token refresh');
    this.name = 'SessionIdentityChangedError';
  }
}

function refreshAccessToken(epoch: number): Promise<string> {
  assertCurrentSession(epoch);
  if (refreshInFlight?.epoch === epoch) return refreshInFlight.promise;

  const promise = apiClient
    .post<unknown>('/api/auth/refresh', null, { sessionEpoch: epoch })
    .then(async ({ data }) => {
      const token = parseTokenResponse(data).accessToken;
      assertCurrentSession(epoch);
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        const identity = await identityClient.get<unknown>('/api/users/me', {
          sessionEpoch: epoch,
          headers: { Authorization: `Bearer ${token}` },
        });
        assertCurrentSession(epoch);
        if (parseUserResponse(identity.data).id !== currentUser.id) {
          expireSession(epoch);
          throw new SessionIdentityChangedError();
        }
      }
      useAuthStore.getState().setAccessToken(token);
      return token;
    })
    .finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    });
  refreshInFlight = { epoch, promise };
  return promise;
}

function expireSession(epoch: number): void {
  if (!isCurrentSession(epoch)) return;
  useAuthStore.getState().clearAuth();
  window.location.assign('/');
}

apiClient.interceptors.response.use(
  (response) => {
    if (response.config.sessionEpoch !== undefined) {
      assertCurrentSession(response.config.sessionEpoch);
    }
    return response;
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) return Promise.reject(asError(error));
    const request = error.config;
    const epoch = request.sessionEpoch;
    if (epoch === undefined) return Promise.reject(error);
    if (!isCurrentSession(epoch)) return Promise.reject(new StaleSessionError());
    if (error.response?.status !== 401 || isAnonymousAuthRequest(request.url)) {
      return Promise.reject(error);
    }

    if (request._retry) {
      expireSession(epoch);
      return Promise.reject(error);
    }

    // An anonymous 401 does not prove that a refresh cookie belongs to this session.
    if (!request.headers?.Authorization) return Promise.reject(error);
    request._retry = true;

    try {
      const token = await refreshAccessToken(epoch);
      assertCurrentSession(epoch);
      request.headers.Authorization = `Bearer ${token}`;
      // A replay failure is returned to the original caller unchanged.
      return apiClient.request(request);
    } catch (refreshError) {
      if (refreshError instanceof SessionIdentityChangedError) {
        return Promise.reject(refreshError);
      }
      if (!isCurrentSession(epoch)) return Promise.reject(new StaleSessionError());
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
        expireSession(epoch);
      }
      return Promise.reject(asError(refreshError));
    }
  },
);

export const fastApiClient = axios.create({
  baseURL: `${env.kgApiBaseUrl}/ai/api/v1`,
  timeout: 20000,
});

fastApiClient.interceptors.request.use((config) => {
  assertRequestEpoch(config);
  const user = useAuthStore.getState().user;
  if (!user || !useAuthStore.getState().isAuthenticated) {
    throw new Error('Authenticated user required for AI API request');
  }
  config.headers['X-User-ID'] = String(user.id);
  return config;
});

fastApiClient.interceptors.response.use(
  (response) => {
    if (response.config.sessionEpoch !== undefined) {
      assertCurrentSession(response.config.sessionEpoch);
    }
    return response;
  },
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.config?.sessionEpoch !== undefined &&
      !isCurrentSession(error.config.sessionEpoch)
    ) {
      return Promise.reject(new StaleSessionError());
    }
    return Promise.reject(asError(error));
  },
);

export function isAxios401(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
