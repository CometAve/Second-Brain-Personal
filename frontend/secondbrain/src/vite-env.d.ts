/// <reference types="vite/client" />

/**
 * Vite 환경 변수 타입 정의
 *
 * ⚠️ 이 파일에 import/export 문을 포함하지 마세요.
 * (타입 augmentation이 작동하지 않습니다)
 */

interface ImportMetaEnv {
  /** API 서버 기본 URL */
  readonly VITE_API_BASE_URL: string;
  /** Knowledge Graph API 서버 기본 URL */
  readonly VITE_KG_API_BASE_URL: string;
  /** OAuth2 Google 로그인 URL */
  readonly VITE_OAUTH2_LOGIN_URL: string;

  // Vite 기본 환경 변수
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
