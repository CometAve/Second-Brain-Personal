import 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Captured when private work begins; checked before dispatch and on response. */
    sessionEpoch?: number;
    _retry?: boolean;
  }
}
