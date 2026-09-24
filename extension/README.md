# SecondBrain Chrome 확장

웹페이지 저장, 드래그 검색, 노트 조회를 제공하는 Manifest V3 확장입니다. 이 작업은 의존성과 필요한 코드·검사 설정을 최신화합니다. 로컬 Compose 연결·서비스 주소와 권한 설정은 별도 `codex/local-compose` 변경을 통합한 뒤 적용합니다.

## 실행

Node **26.10.0**, pnpm **12.6.0**을 사용합니다. `.nvmrc`와 `packageManager`를 함께 고정했습니다.

```sh
nvm install
nvm use
npm install --global pnpm@12.6.0
cp .env.example .env
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm dev
```

```dotenv
VITE_API_BASE_URL=https://api.brainsecond.site
VITE_KG_API_BASE_URL=https://api.brainsecond.site
VITE_GOOGLE_CLIENT_ID=발급받은-Google-OAuth-클라이언트-ID
```

API·KG 주소와 Google OAuth 클라이언트 ID는 필수입니다. 위 주소는 기존 코드에 남아 있는 서비스 연결 예시이며 현재 운영 여부를 검증하지 않았습니다. 검색·인증은 `VITE_API_BASE_URL`, 요약·관련 노트는 기존 `VITE_KG_API_BASE_URL`과 `/ai/api/v1` 경로를 사용합니다. 웹 노트 링크와 API host permission도 기존 서비스 주소를 유지합니다. localhost 기본값과 `VITE_WEB_URL`, 환경별 권한 생성은 로컬 구성 변경에 포함됩니다.

`pnpm dev`는 포트 5174를 사용합니다. Chrome의 `chrome://extensions`에서 개발자 모드를 켜고 생성된 `dist/`를 압축 해제된 확장으로 로드합니다. 정적 결과는 `pnpm build`로 생성합니다. Google OAuth의 확장 ID/클라이언트 등록은 본인 개발 환경과 맞아야 합니다.

## 2026-09-24 의존성 갱신

npm registry의 실제 `latest` 태그, 엔진·peer 범위, 실제 설치/검사 결과를 기준으로 선택했습니다. 다른 직접 의존성도 같은 시점의 최신 안정 버전으로 갱신했으며 정확한 해석 결과는 `pnpm-lock.yaml`에 고정합니다.

| 영역                                               | 적용 버전               |
| -------------------------------------------------- | ----------------------- |
| Node / pnpm                                        | 26.10.0 / 12.6.0        |
| React / React DOM / React 타입                     | 19.3.0                  |
| Vite / React 플러그인 / CRXJS                      | 8.3.0 / 6.1.1 / 2.7.1   |
| TypeScript / typescript-eslint                     | 6.0.3 / 8.70.1          |
| ESLint / @eslint-react                             | 10.11.0 / 5.20.8        |
| Hooks / Refresh / Tailwind lint 플러그인           | 7.1.1 / 0.5.7 / 4.4.0   |
| Tailwind / Tailwind Vite 플러그인 / tailwind-merge | 4.3.3 / 4.3.3 / 3.7.0   |
| Lucide / Zustand / Markdown preview                | 1.48.0 / 5.0.15 / 5.2.1 |

Node 26.10.0은 최신 Current 안정 릴리스이고 24.21.0은 LTS입니다. 이번 작업의 최신 안정 버전 기준에 따라 Node 26에서 실제 설치·검사를 마친 뒤 선택했습니다. [Node 릴리스](https://nodejs.org/en/about/previous-releases), [pnpm 설치 요구 사항](https://pnpm.io/installation)

### 확인한 호환성 제약과 이전

- **TypeScript 7.0.2는 유일한 버전 보류입니다.** 최신 `typescript-eslint@8.70.1`과 parser의 peer 범위가 `>=4.8.4 <6.1.0`입니다. 별도 검증 프로젝트에서 7.0.2 strict 설치가 `ERR_PNPM_PEER_DEP_ISSUES`로 실패하는 것을 확인했습니다. 호환되는 가장 높은 안정 6.x인 **6.0.3**을 `~6.0.3`으로 제한했습니다. peer 강제 재정의나 타입검사 생략은 사용하지 않습니다. [공식 지원 범위](https://typescript-eslint.io/users/dependency-versions/)
- **ESLint 10:** ESLint 9까지만 peer 지원하는 `eslint-plugin-react@7.37.5`를 `@eslint-react/eslint-plugin@5.20.8`의 `recommended-typescript`로 교체했습니다. 최신 Hooks 플러그인에서 기존 두 규칙(`rules-of-hooks`, `exhaustive-deps`)을 유지하며, React Compiler 규칙 묶음의 신규 도입은 포함하지 않습니다. Refresh는 최신 Vite preset API를 사용합니다. 오류 해결을 위해 컴포넌트와 context/hook·button variants·toast 상태의 exports를 분리했고, caught error의 `cause`를 보존했습니다. 오류 severity를 낮추거나 규칙을 끄지 않았습니다. [React ESLint 설치](https://eslint-react.xyz/docs/getting-started/typescript), [교체 안내](https://eslint-react.xyz/docs/migrating-from-eslint-plugin-react)
- **Vite 8 / CRXJS:** 두 content script가 `index.tsx`라는 동일 basename을 쓰면 Rolldown의 `emitFile` 참조가 충돌했습니다. 실제 빌드에서 `Content script fileName is undefined`를 재현했고, `overlay-entry.tsx`와 `drag-search-entry.tsx`로 엔트리 이름 및 참조를 구분해 해결했습니다. 최신 CRXJS가 실재 여부를 검사하면서 실패하던 미사용 `.vite/manifest.json` 리소스 선언도 제거했습니다. Vite/CRXJS를 낮추거나 미발행 PR 코드를 설치하지 않았습니다. [CRXJS 공식 저장소의 재현·원인 #1149](https://github.com/crxjs/chrome-extension-tools/pull/1149)
- Vite 설정은 `rolldownOptions`, Oxc minify, Node ESM의 `import.meta.dirname`과 JSON import attribute로 이전했습니다. TypeScript에서 더 이상 필요한 역할이 없는 `baseUrl`을 제거했으며 `typecheck`는 실제 app/node 프로젝트를 검사하는 `tsc -b`로 바꿨습니다. Tailwind lint는 v4 지원 최신 플러그인으로 다시 활성화하고 자동 교정 가능한 동등 클래스 표기를 적용했습니다. [Vite 8 이전](https://vite.dev/guide/migration)

### pnpm 12 정책

기본 minimum release age는 **24시간**, strict 기본값은 **false**입니다. 업데이트 당시 발행 후 24시간이 지나지 않은 버전들이 있어, pnpm 기본 정책이 명시적으로 선택한 정확한 `패키지@버전` 예외를 `pnpm-workspace.yaml`에 자동 기록했습니다. 기록된 항목은 검토한 최신 안정 버전과 대조했습니다. 전역 대기 시간을 0으로 낮추지 않았습니다. 기존 `onlyBuiltDependencies`는 pnpm 12의 `allowBuilds`로 이전했으며 기존에 허용했던 **esbuild만** 허용합니다. [release age 기본 동작](https://pnpm.io/settings/dependency-resolution#minimumreleaseagestrict), [빌드 허용 설정](https://pnpm.io/settings/build)

## 검증

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm typecheck
pnpm lint
pnpm build
```

아래 결과는 환경 설정 분리 전 2026-09-24 Node 26.10.0/pnpm 12.6.0에서 확인한 strict 설치, 타입검사, ESLint, Vite 8 프로덕션 빌드 기록입니다. 분리 적용 후에도 타입 검사·린트·프로덕션 빌드를 다시 실행해 모두 통과했습니다. 의존성 파일은 그대로여서 설치는 반복하지 않았습니다. lint는 **오류 0건, 기본 warning 25건**입니다. 기존 context·effect·key 관련 권장사항과 별도 CSS/주입된 CSS의 사용자 클래스 경고를 이번 의존성 작업에서 임의로 숨기지 않았습니다. Tailwind의 inline CSS 변환에는 sourcemap 미생성 경고가 남습니다.

합성 Chrome storage/fetch로 API 서비스 함수의 인증 헤더·본문·응답 변환을 검사했습니다. 빌드된 두 content loader가 서로 다른 존재하는 JS 청크를 가리키는지와 background loader의 정적 모듈 import를 확인했습니다. 서로 다른 localhost API origin의 연결 검증은 로컬 구성 쪽 기록으로 분리합니다. 상세 UI, Chrome 실제 권한 처리, 실제 OAuth 계정·백엔드·LLM 연결은 이 최소 검증에 포함하지 않았습니다.
