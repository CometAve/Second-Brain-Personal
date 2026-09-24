# Second Brain 웹 프론트엔드

React·TypeScript·Vite 기반 개인용 웹 클라이언트입니다.

## 실행 환경

- Node.js **26.10.0**: 2026-09-24 기준 최신 안정 Current 릴리스입니다. 최신 LTS는 24.21.0이지만, 이번 작업은 최신 안정 버전을 우선하고 실제 호환성을 검증하는 기준으로 26을 선택했습니다.
- pnpm **12.6.0**: `package.json`의 `packageManager`와 `engines`에 고정합니다.
- 실제 설치 버전과 무결성은 `pnpm-lock.yaml`로 재현합니다.

```sh
cd frontend/secondbrain
nvm install
nvm use
npm install --global pnpm@12.6.0
pnpm install --frozen-lockfile --strict-peer-dependencies
```

`.env`에 사용하는 API 게이트웨이와 OAuth 주소를 지정합니다. Vite 환경 변수는 브라우저 번들에 포함되므로 비밀 키를 넣지 않습니다.

```dotenv
VITE_API_BASE_URL=https://api.example.com
VITE_OAUTH2_LOGIN_URL=https://api.example.com/oauth2/authorization/google
```

```sh
pnpm dev
```

이 작업은 의존성 최신화와 필요한 코드·검사 설정 이전을 포함합니다. 일반 API와 AI API는 기존 `VITE_API_BASE_URL`을 공유하며 AI 경로 `/ai/api/v1`을 유지합니다. localhost 포트·AI origin 분리·Compose 및 배포 정리는 별도 `codex/local-compose` 변경을 통합한 뒤 적용합니다. 인증·조회·저장에는 실제 백엔드가 필요합니다.

기존 `Dockerfile`은 이 작업의 검증 대상이 아닙니다. 최신 컨테이너 실행 구성은 의존성 변경을 통합한 뒤 `codex/local-compose` 쪽 로컬 실행 안내를 따릅니다.

## 의존성 선택과 이전

2026-09-24에 npm 공식 registry의 `latest` 안정 버전과 각 패키지의 peer/engine 범위를 확인했습니다. 코드 변경량을 이유로 이전 메이저를 유지하지 않았습니다.

| 묶음                                        | 적용 버전                               | 이전 내용                                                                |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ |
| React / React DOM / 타입                    | 19.3.0                                  | `useRef` 초기값 명시, nullable DOM ref 타입 반영                         |
| Vite / React plugin / SVGR                  | 8.3.0 / 6.1.1 / 5.2.0                   | Rolldown `codeSplitting.groups`, ESM `import.meta.dirname`으로 설정 이전 |
| TypeScript / typescript-eslint              | 6.0.3 / 8.70.1                          | 지원 범위의 최고 버전; deprecated `baseUrl` 제거                         |
| ESLint / JS 규칙                            | 10.11.0 / 10.0.1                        | ESLint 10 flat config                                                    |
| React ESLint 대체 / Hooks / Refresh         | 5.20.8 / 7.1.1 / 0.5.7                  | `@eslint-react/eslint-plugin` 도입, root route와 레이아웃 분리           |
| Tailwind / Vite 통합 / Tailwind ESLint      | 4.3.3 / 4.3.3 / 4.4.0                   | CSS 테마·플러그인 이전, v3 클래스 의미 보존                              |
| tailwind-merge                              | 3.7.0                                   | Tailwind 4 클래스 병합                                                   |
| Milkdown 직접 패키지                        | 모두 7.22.2                             | 내부 패키지 버전 일치                                                    |
| TanStack Query / Router / plugin / devtools | 5.103.2 / 1.170.39 / 1.168.40 / 1.167.2 | 실제 peer 범위를 만족하는 최신 조합                                      |
| Zod                                         | 4.6.5                                   | Zod 3 전용 adapter 제거, `validateSearch`에 schema 직접 전달             |
| Three / 타입 / react-force-graph-3d         | 0.186.0 / 0.186.0 / 1.29.1              | 엔진·타입 버전 일치                                                      |
| Lucide / Axios / Zustand                    | 1.48.0 / 1.20.0 / 5.0.15                | 최신 안정 버전                                                           |
| Commitlint / concurrently / lint-staged     | 21.2.3 / 10.0.5 / 17.5.1                | Node 26에서 설치·검사 도구 실행                                          |

표 외 직접 의존성도 registry의 최신 안정 버전으로 맞췄습니다. 각 정확 버전은 잠금 파일에 있습니다.

### 해결되지 않은 최신 버전 제약

TypeScript 최신 안정 **7.0.2**와 최신 `typescript-eslint` **8.70.1**을 함께 둔 별도 최소 프로젝트에서 `pnpm install --lockfile-only --strict-peer-dependencies --ignore-scripts`를 실행했으며, `ERR_PNPM_PEER_DEP_ISSUES`가 발생했습니다. parser·project-service 등도 `typescript >=4.8.4 <6.1.0`을 요구합니다. peer를 무시하거나 강제 override하지 않고 범위 내 최고 안정 **6.0.3**을 사용합니다. [공식 지원 범위](https://typescript-eslint.io/users/dependency-versions/)

기존 `eslint-plugin-react` 7.37.5는 ESLint peer가 `^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7`이므로 제거했습니다. ESLint 10.3 이상을 공식 지원하는 `@eslint-react/eslint-plugin`의 `recommended-typescript`로 대체했습니다. Hooks 플러그인은 기존 `rules-of-hooks: error`, `exhaustive-deps: warn` 검사 범위를 유지합니다. React Compiler 도입은 이번 작업에 포함하지 않습니다. [대체 플러그인 설치 안내](https://eslint-react.xyz/docs/getting-started/typescript)

### pnpm 12 설치 정책

pnpm 12의 기본 최소 발행 기간은 1,440분이며 기본 non-strict 모드는 명시한 버전을 설치할 때 정확한 `패키지@버전` 예외를 자동 기록합니다. 이번 최신 안정 후보 중 Milkdown 7.22.2, ESLint React 5.20.8, Router 1.170.39, Lucide 1.48.0 등이 발행 24시간 미경과 상태여서 `minimumReleaseAgeExclude`가 자동 생성되었습니다. 실제 선택한 버전과 일치하는 항목만 유지했으며, 전역 대기 기간을 0으로 바꾸지 않았습니다. [공식 정책](https://pnpm.io/settings/dependency-resolution#minimumreleaseagestrict)

기존 pnpm 10 잠금 파일에 대한 첫 정책 검증은 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`으로 실패했습니다. 최신 조합을 pnpm 12에서 다시 해석해 잠금 파일을 생성한 뒤 frozen 설치를 확인했습니다. `onlyBuiltDependencies`는 pnpm 12의 `allowBuilds`로 이전했고, 기존에 허용된 `esbuild`만 허용합니다. [빌드 정책](https://pnpm.io/settings/build)

## 검증

```sh
pnpm install --frozen-lockfile --strict-peer-dependencies
pnpm typecheck
pnpm lint
pnpm build
```

아래 결과는 환경 설정 분리 전 Node 26.10.0 / pnpm 12.6.0 / macOS arm64에서 확인한 설치·타입 검사·린트·프로덕션 빌드 기록입니다. 분리 적용 후에도 타입 검사·린트·프로덕션 빌드를 다시 실행해 모두 통과했습니다. 의존성 파일은 그대로여서 설치는 반복하지 않았습니다. 검증 설치에서는 `HUSKY=0`으로 Git hook 재설정만 생략했습니다.

- ESLint: 오류 0개, 새 React 권장 규칙의 기본 경고 18개. 기존 `forwardRef` 사용 10개, effect 내부 setState 6개, render 중 `Date.now()` 1개, ref 이름 1개입니다. 에러를 경고로 낮추거나 규칙을 끄지 않았으며, 기존 코드 정리는 별도 범위입니다.
- 최소 API 검증: 격리된 Chrome과 합성 API에서 React 19 앱 부팅·Three canvas 초기화, Zod 4 draft 검색 매개변수, Milkdown 입력 이벤트의 draft API 전달(200)을 확인했습니다. page error는 없었고, 닫힌 임시 draft 조회에 대한 fixture의 예상 404 한 건이 있었습니다.
- 빌드: 대형 Graph/NoteEditor 청크 경고는 남습니다. 상세 UI 검수, 기존 기능 버그 수정, 실제 OAuth·서버·DB 연동 및 다른 브라우저 검증은 수행하지 않았습니다.

Tailwind 4 이전에 필요한 테마·클래스·개별 `translate` 전환 속성 변경은 유지했습니다. 별도로 추가했던 숨김 패널 visibility 보완은 의존성 업데이트 범위에서 제외했습니다. Tailwind 4의 지원 대상은 Safari 16.4+, Chrome 111+, Firefox 128+입니다. [이전 안내](https://tailwindcss.com/docs/upgrade-guide)

## 공식 근거

- [npm 공식 registry](https://registry.npmjs.org/)
- [Node.js 릴리스](https://nodejs.org/en/about/previous-releases)
- [pnpm 12 설치 조건](https://pnpm.io/installation)
- [React 19 이전](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [Vite 8 이전](https://vite.dev/guide/migration)
- [Rolldown 청크 분리](https://rolldown.rs/in-depth/manual-code-splitting)
- [TanStack Router의 Zod 4 연결](https://tanstack.com/router/latest/docs/guide/search-params#zod)
- [ESLint React 이전과 규칙 비교](https://eslint-react.xyz/docs/migrating-from-eslint-plugin-react)
- [React Refresh 설정](https://github.com/ArnaudBarre/eslint-plugin-react-refresh)
