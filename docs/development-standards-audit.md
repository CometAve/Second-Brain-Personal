# 개발 지침 감사 및 적용 기록

2026-09-24, `codex/development-standards`의 기준 커밋 `68b1817`에서 확인했다. [issue #1](https://github.com/CometAve/Second-Brain-Personal/issues/1)의 개발 규칙 정비를 위한 기록이며, 작업 지침의 진입점은 [AGENTS.md](../AGENTS.md)다. 이 감사 기록은 배경 근거이며 매 작업마다 읽어야 하는 문서는 아니다.

## 범위와 결과

사용자가 제공한 과거 `Legacy_Projects/Second-Brain/.agents/skills`의 **8개 스킬, Markdown 82개 파일 전부**를 검토했다. 원본은 참고 자료로 읽고 보존했으며, 현재 프로젝트에는 적용할 내용을 재작성한 5개 스킬을 추가했다. 기존 공식 Playwright CLI 스킬은 유지한다.

| 새 지침 | 역할 |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | 공통 품질 기준, 변경 경계, 조건별 스킬 연결, 완료 조건 |
| [typescript-standards](../.agents/skills/typescript-standards/SKILL.md) | 현재 TS 설정·외부 데이터 검증, Zod 4 참고 |
| [react-patterns](../.agents/skills/react-patterns/SKILL.md) | 렌더·Effect·이벤트의 정확성, 조건부 성능 참고 |
| [state-management](../.agents/skills/state-management/SKILL.md) | 상태 소유권, Zustand 5, 웹 전용 Query 5 참고 |
| [tailwind-styling](../.agents/skills/tailwind-styling/SKILL.md) | Tailwind 4, 웹/확장 테마와 Shadow DOM 경계 |
| [project-verification](../.agents/skills/project-verification/SKILL.md) | 실제 검사 명령, 브라우저 재현, 증거와 완료 판단 |

Next.js, Jotai, SWR, React Hook Form, Vitest/RTL/MSW, `better-all` 전용 예제는 적용 대상에서 제외했다. SOLID의 책임·계약 기준은 공통 지침에 통합하고, 폼 규칙의 Zod·접근성·오류 보존 기준은 해당 스킬로 옮겼다. `nextjs-best-practices`에 있던 React `Activity`는 React 공통 API이므로 선택적 참고로 살렸다. 미사용 라이브러리를 설치하거나 앱 코드·검사 설정을 바꾸지 않았다.

## 버전 확인 방법과 기준

manifest의 범위와 잠금 파일의 정확 버전을 구분했다. 양쪽 `pnpm-lock.yaml`은 YAML 문서 2개이며, pnpm 자체를 담은 첫 문서가 아닌 앱 importer를 확인했다. **웹 직접 의존성 53개, 확장 40개 전체의 잠금 버전과 설치된 package.json이 일치**했다. 아래는 가져온 규칙·검사 명령과 관련된 버전이다.

| 라이브러리·도구 | 웹 | 확장 |
| --- | --- | --- |
| Node / pnpm 실행 기준 | 26.10.0 / 12.6.0 | 동일 |
| React / React DOM / React 타입 | 19.3.0 | 동일 |
| TypeScript | 6.0.3 | 동일 |
| Vite / React plugin | 8.3.0 / 6.1.1 | 동일 |
| Zustand | 5.0.15 | 동일 |
| TanStack Query | 5.103.2 | 직접 의존성 없음 |
| TanStack Router / router-plugin | 1.170.39 / 1.168.40 | 직접 의존성 없음 |
| Zod | 4.6.5 | 직접 의존성 없음 |
| Tailwind CSS / Vite plugin | 4.3.3 / 4.3.3 | 동일 |
| tailwind-merge / CVA / clsx | 3.7.0 / 0.7.1 / 2.1.1 | 동일 |
| 애니메이션 | tailwindcss-animate 1.0.7 | tw-animate-css 1.4.0 |
| Lucide | 1.48.0 | 동일 |
| ESLint / typescript-eslint | 10.11.0 / 8.70.1 | 동일 |
| @eslint-react/eslint-plugin | 5.20.8 | 동일 |
| Hooks / Refresh lint plugin | 7.1.1 / 0.5.7 | 동일 |
| Tailwind lint plugin | 4.4.0 | 동일 |
| Prettier / Tailwind plugin | 3.9.9 / 0.8.1 | 동일 |
| commitlint / Husky / lint-staged | 21.2.3 / 9.1.7 / 17.5.1 | 동일 |
| Playwright CLI (로컬 전역 도구) | 0.1.21 | 같은 CLI; 프로젝트 lock에 포함되지 않음 |

React 공식 문서의 현재 범위는 19.3, Zod는 4.6, Tailwind는 4.3이다. Zustand·Query·CVA·애니메이션 패키지는 정확 태그와 설치된 공개 타입/소스를 대조했다. 상세 API 근거 링크는 해당 스킬에 둔다. 변하는 `latest` 문서만 보고 다른 버전의 API를 채택하지 않았다. 이 표는 전체 스택 업그레이드 감사나 모든 전이 의존성의 호환성 인증이 아니다.

## 실제 교정한 내용

- Zustand `create` hook의 v4식 두 번째 equality 인자를 `useShallow`/개별 selector 기준으로 교정했다.
- Query는 v5 object API·`gcTime`·`initialPageParam`과 5.103.2 callback 인자를 기준으로 했다. 확장에 Query 도입을 강제하지 않는다.
- Zod v3 오류 옵션을 v4 `error`/`issues` 등으로 교정했다. 웹 Router의 Zod 4 직접 연결을 안내하고 RHF/v3 adapter를 추가하지 않는다.
- React 19의 JSX namespace, `useEffectEvent`의 identity·사용 경계, transition의 의미를 수정했다. memo·preload·캐시·성능 수치는 조건부 판단으로 바꿨다.
- TS `lib: ES2022`, `erasableSyntaxOnly`, type-only import와 TS 5.5 이후 predicate 추론을 반영했다. `as Result`를 외부 데이터 검증으로 부르던 예제를 제거했다.
- Tailwind v3 config/지시문 대신 현재 v4 CSS 설정을 기준으로 했다. 웹 HSL/애니메이션 plugin과 확장 OKLCH/CSS import/Shadow DOM을 구분했다.
- `extension/components.json`의 shadcn 설정은 설치된 로컬 컴포넌트 소스와 aliases를 확인하는 근거로만 사용했다. 최신 registry의 Field·Spinner·새 Button API가 이미 설치되어 있다고 가정하거나 컴포넌트를 재설치하지 않는다.

## OpenAI 지침을 적용한 방식

사용자가 지칭한 글은 **2026-09-11의 [Rethinking skills and prompts for GPT-6 Astra](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)**로 확인했다. 설명은 짧고 구체적으로 만들고, 관련 자료만 조건부로 연결하며, 고정 작업 순서·반복 점검·불필요한 확인은 줄였다. 모델별 스킬 복제본은 만들지 않았다. 품질 기준을 없애라는 뜻으로 해석하지 않고, 오류 은폐·검사 우회·데이터 유실을 막는 완료 기준을 남겼다.

[공식 스킬 작성 안내](https://developers.openai.com/plugins/build/skills)와 [지시 충돌 안내](https://developers.openai.com/api/docs/guides/latest-model#gpt-6-astra-instruction-following)에 따라 사용자 요청의 우선순위, 이미 받은 승인, 중단 이유의 설명을 공통 지침에 명시했다. 이 방식은 이번 프로젝트에 대한 적용 판단이며 모든 모델에서 성능 향상이 측정됐다는 주장은 아니다.

## 검사 및 적용 리뷰

- 공식 `skill-creator/scripts/quick_validate.py`로 신규 5개 스킬의 frontmatter·이름·미완성 placeholder 검사를 통과했다. 프로젝트 의존성을 추가하지 않고 기존 캐시의 PyYAML을 사용했다.
- 새 지침의 로컬 Markdown 링크가 모두 실제 배치 위치에서 연결되며, 원본 82개 파일과 판정표 82개 항목이 일대일로 일치하는지 확인했다.
- Zustand 예제는 실제 `searchPanelStore`를 import해 설치된 TypeScript 6.0.3의 strict/noEmit 검사로 확인했다.
- Zod 4.6.5 예제는 정상 응답·음수 ID·잘못된 제목 타입·null 입력과 `issues`, `flattenError`, `treeifyError`를 실행 확인했다.
- 독립 에이전트가 오류 fallback, 제목 오타, Zustand API 정리, 정당한 타입 단언, 한글 저장 유실의 **5개 요청**에 지침을 적용해 해석을 검토했다. 단순 문구 변경의 과도한 브라우저 검사와 IME 검증의 표현을 보완했다. 이는 문서의 행동 경계 검토이며 실제 기능 구현·브라우저 회귀 테스트는 아니다.
- 지침만 바뀌므로 앱 전체 lint/build·실서버·OAuth·LLM·실제 IME 테스트를 새로 실행한 것으로 보고하지 않는다.

## 지침 영문화 및 참고자료 구조 재검토

2026-09-24에 각 스킬이 연결한 공식 영문 자료를 다시 읽고 새 지침을 영어로 다듬었다. 이 감사 기록은 사용자가 검토하는 문서이므로 한국어로 유지한다. 변경 범위 밖의 기존 프로젝트 문서와 한국어 커밋 메시지 규칙은 보존했다. API 식별자, 패키지별 적용 범위, 조건과 승인 경계를 한국어 초안 및 설치된 타입과 대조했으며, 원문의 설명이 모호한 곳은 의미를 확인해 보완했다.

현재 [OpenAI 스킬 작성 안내](https://developers.openai.com/plugins/build/skills)와 내장 `skill-creator`는 구체적인 설명, 필요한 참고자료의 조건부 로딩, 작업에 맞는 상세도를 권장한다. 참고자료마다 YAML 메타데이터·영향도 등급·고정된 제목 순서를 넣을 필요는 없다. 이 프로젝트에서는 구현 판단에 영향을 주는 적용 범위, 판단 조건, 예제의 전제, 버전 근거를 명시했다. 단순한 Markdown 서식 자체가 결함의 근거는 아니며, 서식을 자세히 만들거나 이번 검토를 통과했다고 모델의 오판 가능성이 없어지는 것은 아니다.

공식 Playwright 참고자료는 작업별 제목·문법·구체적인 명령 예시를 살펴보는 비교 대상으로 사용했다. 동일한 서식을 강제하는 기준으로 삼지는 않았다. 검토 당시 [공식 CLI 저장소의 `74354ec` 리비전](https://github.com/microsoft/playwright-cli/tree/74354ecc7a43da16d91a9bc54fa8db8283a3fcf5)과 [npm 패키지 메타데이터](https://registry.npmjs.org/@playwright/cli)는 모두 최신 버전을 **0.1.21**로 표시했으며, npm 배포일은 2026-09-18이다. **로컬 스킬 파일 11개 전체**가 배포 tarball 및 해당 저장소 리비전과 SHA-256 기준으로 일치했다. 공식 배포 스킬은 수정하지 않았다.

최신 공식 예제에도 적용 시 주의가 필요한 내용이 있어 프로젝트 [브라우저 참고자료](../.agents/skills/project-verification/references/browser-checks.md)에 다음 사항을 보완했다.

- `networkidle`, 일정 시간 대기, 클릭 명령의 완료만으로 성공을 판단하지 않고 기대하는 UI 상태나 관련 응답을 확인한다. 모든 조작 실패를 요소가 없는 오류로 바꾸지 않고 실제 원인을 보존한다. [Playwright 조작 가능성 검사](https://playwright.dev/docs/actionability)와 [로드 상태 안내](https://playwright.dev/docs/api/class-page#page-wait-for-load-state)를 대조했다.
- `run-code` 콜백 실행 환경과 브라우저 평가 환경을 구분한다. 공식 참고자료에 타이머 예제가 있지만 CLI에 포함된 엔진은 해당 콜백에 전역 `setTimeout`이나 Node 모듈 전역을 제공하지 않는다. 정확한 [엔진 소스](https://github.com/microsoft/playwright/blob/78ff4260d79b924724bdcc4ccd89e463b8f43b0d/packages/playwright-core/src/tools/backend/runCode.ts)와 설치된 번들을 확인했다.
- 권한 재정의 해제와 위치정보 변경, CLI 브라우저 확인과 Playwright Test 도입을 구분한다. 검증 결과물과 정리 작업의 범위도 해당 세션으로 제한한다.

CLI 패키지는 Playwright/Playwright Core **1.64.0-alpha-1789764292000**에 고정되어 있다. CLI의 0.1.21 배포 표기가 내부 엔진까지 안정 버전이라는 뜻은 아니다. 당시 셸에서 확인된 CLI는 Node **24.15.0** 설치 경로에 있었으므로 프로젝트가 요구하는 Node **26.10.0**에서 재실행 검증한 것으로 보고하지 않는다. 런타임·CLI·의존성 업그레이드는 수행하지 않았다.

이 밖에 `useEffectEvent`의 Effect 소유 콜백, 외부 store snapshot의 안정성과 불변성, `Activity`가 보존하는 DOM의 동작, Zod의 알 수 없는 키 제거 동작을 명확히 했다. 스키마 예제는 실제 프로젝트 API 계약이 아닌 설명용 예제임을 표시했다. Query 안내의 “last argument” 문장이 같은 문서의 예제 및 현재 서명과 달라 콜백 인자 위치는 **5.103.2** 타입으로 대조했다. 원래 감사표에서 잘렸던 strict-null 항목은 과거 원본을 확인해 복원했다.

영문 수정본은 공식 스킬 검증 5개, 로컬 링크·Markdown 구조 검사, 원본 판정표 82개 항목 대조를 통과했다. 별도 의미 검토에서 승인 범위 안의 검사 실패 수정을 좁히던 번역을 발견해 바로잡았다. 또 다른 독립 검토에서는 저장 상태 성공 판단, 공식 타이머·준비 상태 예제, README 오타, 해석 신뢰성의 보장 한계라는 네 가지 상황을 확인했다. Zustand 예제는 설치된 TypeScript로 다시 검사했고, Zod 예제 및 관련 실패·기본값·형 변환 동작은 설치된 Zod로 실행 확인했다. 이는 문서와 예제 검증이며 새 앱 빌드나 실제 브라우저 테스트가 아니다.

## 판단을 명확히 하는 예제 보강

사용자가 요청한 목적은 모델이 구현 중 품질 기준을 타협하지 않도록 판단 근거를 구체화하는 것이다. 신규 스킬 5개와 참고자료를 다시 확인해, 원칙을 알아도 적용 대상을 혼동하거나 실패 경로를 빠뜨리기 쉬운 규칙을 골랐다. 모든 규칙에 같은 분량의 예제를 붙이거나 과거 82개 파일을 그대로 복구하지 않았다.

예제는 영어로 작성하고 관련 작업일 때만 읽도록 스킬 진입점에서 연결한다. 각 사례에는 필요한 적용 조건, 잘못된 코드의 문제, 권장 코드 또는 판단 흐름, 적용하면 안 되는 경우와 확인할 결과를 설명한다. 설명용으로 축약한 계약은 실제 프로젝트 API 계약과 구분한다. 링크는 공식 근거와 추가 설명으로 유지하고, 예제의 핵심 판단은 로컬 파일에서 확인할 수 있게 한다.

공개 import 경로, ES2022에서 복사 후 정렬, 미설치 라이브러리 도입 제한, 기본 브라우저 검증 범위는 현재 문장으로 판단이 분명해 추가 예제를 만들지 않았다. 복잡한 낙관적 갱신에는 여러 동시성 정책이 가능하므로 하나의 범용 구현을 정답으로 제시하지 않는다. 실제 저장·삭제 정책이나 상태 관리 구조의 변경은 이번 문서 보강에 포함하지 않았다.

### 보강한 판단과 적용 범위

| 판단 | 보강 내용과 참고자료 |
| --- | --- |
| 수동 요청의 생명주기 | [요청 생명주기 예제](../.agents/skills/react-patterns/references/manual-request-lifecycle.md): 이전 요청의 성공뿐 아니라 catch/finally도 현재 화면을 덮어쓰지 않게 한다. 기존 Query 요청을 수동 Effect로 옮기도록 요구하지 않는다. |
| Effect 재동기화와 최신 값 읽기 | [Effect Event 경계 예제](../.agents/skills/react-patterns/references/effect-event-boundaries.md): 구독 대상은 dependency로 유지하고, 알림 표시 값만 최신 committed 값으로 읽는다. |
| 확장 메시지의 타입 검증 | [확장 메시지 guard](../.agents/skills/typescript-standards/references/extension-message-guards.md): 태그만 검사하면서 전체 payload 타입을 주장하는 경우와 실제 구조를 검사하는 경우를 비교한다. 실제 AUTH_CHANGED 알림에 가상의 user 필드를 강제하지 않으며, 발신자 신뢰 확인을 별도로 유지한다. |
| 검증 실패와 정상 빈 결과 | [Zod 경계 예제](../.agents/skills/typescript-standards/references/external-data.md): malformed 응답을 빈 배열로 바꾸는 코드와 유효한 빈 배열·검증 실패를 구분하는 코드를 비교한다. 웹에 설치된 Zod 4.6.5만 사용한다. |
| selector 결과의 안정성 | [Zustand 예제](../.agents/skills/state-management/references/zustand-updates.md): 매번 새 객체를 만드는 selector와 useShallow를 비교하고, 단일 값 selector에는 불필요하다는 조건을 명시한다. |
| Set 갱신과 이전 snapshot 보존 | 같은 Zustand 참고자료에서 새 wrapper 안의 기존 Set을 변경하는 경우와 Set을 복사한 뒤 추가·삭제하는 경우를 비교한다. |
| mutation 완료와 캐시 재조회 완료 | [Query 예제](../.agents/skills/state-management/references/tanstack-query.md): useMutation 설정의 Promise 반환과 의도적인 background invalidation을 구분한다. 개별 mutate/mutateAsync 호출의 콜백은 반환 Promise를 기다리지 않는다는 적용 위치를 명시한다. |
| 동시 낙관적 갱신의 rollback | 같은 Query 참고자료에 이전 요청의 rollback이 나중에 성공한 값을 덮어쓰는 순서표를 추가했다. scope.id가 onMutate까지 직렬화하지 않는 점과 이전 캐시가 없을 때의 정리 조건도 명시한다. |
| 색상 토큰의 형식 | [Tailwind 색상 예제](../.agents/skills/tailwind-styling/references/color-tokens.md): 웹의 HSL 채널값과 확장의 완전한 OKLCH 색상값을 비교한다. 확장 페이지의 :root와 overlay의 :host 경계는 유지한다. |

### 검증 결과와 한계

- 실제 설치된 React/타입 19.3.0, TypeScript 6.0.3, Hooks lint plugin 7.1.1, Zustand 5.0.15, Query 5.103.2, Zod 4.6.5, Tailwind 4.3.3을 확인하고 각 참고자료에 공식 영문 근거를 연결했다.
- 최종 Markdown의 코드 블록을 추출해 타입 검사했다. React 권장 예제는 현재 Hooks의 rules-of-hooks·exhaustive-deps 검사도 통과했다. React 수동 요청 함수는 현재 요청 실패, 오래된 성공·실패, cleanup 이후 완료 등을 포함한 정상 사례 6개와 잘못된 예제의 대조 사례 2개를 실행했다.
- TypeScript 메시지 guard 19개 입력, Zod 목록 검증 16개 입력, 잘못된 예제의 대조 사례 2개를 실행했다. 잘못된 guard와 오류 은폐 코드도 타입 검사는 통과할 수 있다는 점을 동작으로 확인했다.
- Zustand Set 예제는 이전 snapshot 보존과 추가·삭제 시 참조 변경을 확인했다. Query는 Promise 반환 여부에 따른 pending, 쓰기 실패와 재조회 실패, 같은 scope에서 onMutate가 먼저 실행될 수 있는 동작을 설치된 Query로 확인했다.
- Tailwind CSS 예제 4개를 양쪽 패키지의 4.3.3 compiler로 처리했다. 잘못된 토큰 조합도 컴파일은 될 수 있으므로, 컴파일 성공을 브라우저의 최종 색상·테마·Shadow DOM 검증으로 취급하지 않는다.
- 독립 검토 에이전트가 수정이 필요한 콜백 적용 위치를 찾아 보완했다. AUTH_CHANGED 알림 검증, 재조회 실패를 포함한 mutation 완료 판단, 확장 페이지로 스타일 이동이라는 세 가지 요청의 적용 판단도 검토했다. 이는 실제 기능 구현의 비교 실험은 아니다.
- 보강한 스킬 4개의 공식 형식 검사와 로컬 링크·코드 블록 구조 검사를 통과했다. 검사 스크립트·출력은 임시 검토 폴더에서 실행했으며 프로젝트 의존성은 추가하지 않았다.
- 검사 런타임은 현재 셸의 Node 24.15.0이었다. 프로젝트 기준인 Node 26.10.0에서 앱을 실행한 것으로 보고하지 않는다. React 실제 렌더링, 실제 네트워크·저장, OS IME, 브라우저·Shadow DOM, 앱 전체 lint/build는 이번 예제 검증에 포함하지 않았다.

이 보강의 효과는 예제의 타입·실행 검증과 제한된 적용 검토 범위에서 평가한다. 같은 모델·작업·버전으로 간결본과 예제 보강본을 비교한 성능 실험을 수행한 것은 아니므로, 코드 품질 향상이나 오판 감소가 측정됐다고 주장하지 않는다.

## React·TypeScript 판단 기준 및 선언 규칙 보강

2026-09-25, React 메모이제이션·Effect·배럴 export 검토 이후 사용자가 보강을 요청한 항목을 반영했다. 새 지침은 영어로, 이 기록은 한국어로 작성한다. 기존 원칙을 일괄 금지 목록으로 바꾸지 않고, 실제 오류를 막는 기준과 사용자가 선택한 프로젝트 선언 규칙을 구분했다.

사용자가 이번에 지정한 **프로젝트 컴포넌트의 React.FC 전면 금지**는 이전 TS 스킬의 “전면 금지하지 않는다”는 선택을 대체한다. `FC`, `FunctionComponent` 및 별칭도 포함하고 일반 함수와 명명한 props 타입을 사용한다. React 19.3 타입에 해당 기능이 없거나 성능상 문제가 있어서 금지한다는 설명은 하지 않는다. **named export와 정의 파일 직접 import**를 기본으로 하고 handwritten 앱 코드의 default export·배럴 집계를 지양한다. 외부 패키지의 공개 경로, Vite·ESLint가 읽는 설정 export, `React.lazy`의 loader 객체 형식은 실제 소비자의 계약에 맞게 구분한다.

### 관심 사항별 반영

| 관심 사항 | 적용한 기준과 예제 |
| --- | --- |
| useMemo·useCallback·memo | [메모이제이션 판단](../.agents/skills/react-patterns/references/memoization-decisions.md)에 계산 결과·함수 참조·컴포넌트 렌더 재사용을 구분했다. 값싼 계산과 일반 버튼 핸들러에 자동 적용하지 않으며, 비용이 큰 계산 외에도 실제 소비자의 참조 안정성에 따른 이득을 검토한다. 일반 기능 개발에서 메모이제이션을 추가할 때도 해당 참고자료를 읽도록 연결했다. |
| Effect·이벤트·커스텀 Hook | [Effect 선택](../.agents/skills/react-patterns/references/effect-decisions.md)에 파생 label의 나쁜/권장 예제를 넣었다. 사용자 명령, 외부 동기화, 웹 Query, 확장 service/subscription의 소유권을 구분한다. 범용 mount-only wrapper와 목적별 Hook을 구분하고, Hook 내부에서 렌더 중 요청을 시작하는 것도 금지한다. |
| named/default/barrel export | [모듈 규칙](../.agents/skills/typescript-standards/references/module-exports.md)에 직접 named export/import와 배럴의 차이, type-only 경로, 외부 패키지·도구 계약을 설명했다. named component를 유지하면서 lazy loader의 `default` 프로퍼티에 연결하는 예제를 추가했다. 개발 서버의 모듈 처리 비용과 최종 번들 크기를 구분한다. |
| props·서버 데이터 복사 및 편집 draft | [상태와 identity](../.agents/skills/react-patterns/references/state-and-identity.md)에 부모가 소유한 값의 불필요한 state 복사와 직접 표시를 비교했다. 독립 편집 draft는 허용하되 저장·취소·대상 변경·재조회 정책을 명시하고, 자동 덮어쓰기나 미승인 초기화를 피한다. |
| 모순된 상태·mode별 props | [상태 타입 모델링](../.agents/skills/typescript-standards/references/state-type-modeling.md)과 [컴포넌트 타입 계약](../.agents/skills/typescript-standards/references/component-type-contracts.md)에 상태별 payload·필수 callback·exhaustive 분기를 제시했다. 독립 상태 차원이나 Query의 이전 데이터와 재조회/error 공존까지 억지로 배타적 union으로 바꾸지 않는다. |
| React.FC·인라인 타입 | 컴포넌트 타입 참고자료에 금지 대상인 FC 계열과 일반 함수의 대비를 넣었다. 컴포넌트 props와 복잡하거나 재사용되는 계약에는 이름을 붙이고, 작은 지역 타입·문맥으로 추론되는 callback까지 모두 추출하도록 강제하지 않는다. |
| any·타입 단언 | 기존 unknown·경계 검증 원칙을 유지하고 편의 목적의 any, unsafe as, 이중 단언, non-null assertion을 피하도록 연결했다. 정당한 좁은 호환성 예외, `as const`, `satisfies`를 무조건 금지하지 않으며 런타임 검증을 대신하지 못함을 명시했다. |
| useState 초기값의 잘못된 추론 | 빈 배열의 never[], null-only 선택, 너무 넓은 string, as const로 고정된 단일 상태를 비교했다. 실제 미래 값에 맞는 배열·nullable·status union generic을 사용하며 가짜 초기 객체 단언으로 해결하지 않는다. |
| 컴포넌트 내부 컴포넌트 정의 | 상태 참고자료에 새 컴포넌트 identity로 입력 상태가 초기화되는 예와 모듈 수준 선언을 비교했다. 일반 이벤트 핸들러·render callback과 구분한다. |
| 배열 index key | 삭제·필터·정렬 가능한 행에 record ID를 사용하고, index에 따라 행의 로컬 상태가 다른 항목에 붙는 예를 추가했다. 렌더 중 난수·useId도 대안으로 삼지 않는다. 고정 위치의 제한적 예외가 기존 lint 해제의 근거가 되지 않도록 했다. |
| 객체·배열 직접 수정 | 새 바깥 배열 안에서 기존 중첩 객체를 수정하는 나쁜 예와 변경 경로를 복사하는 updater 예를 비교했다. 이전 snapshot 보존, 변경/미변경 참조, updater 순수성, 새 지역 객체의 구성과 기존 state 변경의 차이를 명시했다. |
| ref와 화면 상태 | 화면 변화에 반응해야 할 값을 ref로 대신하지 않고, ref 변경이 렌더를 요청하지 않음을 명시했다. 렌더 중 읽기/쓰기 제한과 예측 가능한 초기화 예외를 구분한다. |

공통 진입점인 [AGENTS.md](../AGENTS.md)에도 export와 컴포넌트 선언 규칙을 추가했다. React·TS·상태 관리 스킬은 관련 참고자료를 조건별로 연결한다. 이미 충분한 요청 생명주기·Effect Event·외부 데이터 guard 예제는 보존했으며, 기존 코드 전체를 새 선언 형식으로 바꾸거나 ESLint 설정을 추가하는 작업은 수행하지 않았다. 따라서 문서 규칙의 추가가 새 lint 자동 강제까지 완료했다는 의미는 아니다.

### 근거와 검증

- 양 앱의 manifest·lockfile·설정·설치 패키지를 확인했다. React/React 타입 19.3.0, TypeScript 6.0.3, Vite 8.3.0, Hooks lint 7.1.1, Zustand 5.0.15이며 웹만 Query 5.103.2를 직접 사용한다. React Compiler는 구성되어 있지 않다. 각 참고자료는 관련 React·TypeScript·Vite·Rolldown의 공식 영문 원문을 연결한다.
- React의 신규 코드에서 10개 완결 예제를 추출해 양 앱의 실제 TS 설정으로 검사했다(20회). 권장 예제 또는 대비 예제의 Hooks 검사 6개를 양 앱에서 수행했다(12회). 중첩 상태 업데이트는 동결된 이전 snapshot, 변경·미변경 참조, 반복 갱신, 대상 없음·빈 배열과 잘못된 예제 대조를 실행 확인했다.
- 타입 계약의 코드 블록 9개와 유효/오류 대조 16개를 양 앱 설정으로 확인했다(50개 기대 결과 일치). 잘못된 초기 추론, 상태 오타, 필수 payload·callback 누락, 새 union 분기 누락, satisfies의 제한을 포함한다. FC 예제 자체도 타입 검사를 통과하므로 프로젝트 규칙 위반과 컴파일 오류를 구분한다.
- export 예제를 두 앱의 실제 TS 설정으로 확인했다(4개 모듈 구성 검사). named export·직접 import·lazy adapter가 일치하며, 지양하는 default/barrel 예제도 TypeScript 자체에서는 유효함을 확인했다.
- 독립 적용 검토에서 편집/저장·대상 전환, 선택적 미리보기와 import/export, 타입·리스트·컴포넌트 구성의 세 시나리오를 검토했다. TS 단독 작업의 모듈 규칙 진입 링크를 확인했고, Effect를 소유한 Hook의 계약이 상태 전용 Hook에까지 적용되지 않도록 문장을 좁혔다.
- 공식 스킬 검증, Markdown의 로컬 경로·코드 블록·공백·영문 여부, 기존 원본 판정표 82개 항목의 보존을 확인했다. 검사 파일과 결과는 임시 검토 경로에 두고 프로젝트 의존성은 추가하지 않았다.
- 실행 런타임은 Node 24.15.0이었다. 프로젝트 지정 Node 26.10.0의 앱 전체 lint/build, 실제 React 렌더러·브라우저의 상태/focus 보존, 동적 import 실행, 서버 저장, 성능·번들 크기 측정은 이번 문서 검증에 포함하지 않았다. 규칙 간 비교 실험이나 코드 품질 향상이 측정됐다고 주장하지 않는다.


## 상수 데이터의 이름과 소유권 규칙 보강

2026-09-25, 사용자가 요청한 상수 명명·배치 기준을 [상수 데이터 참고자료](../.agents/skills/typescript-standards/references/constants.md)에 추가하고 AGENTS·TypeScript·React 진입점에 연결했다. 새 참고자료와 활성 지침은 영어로 작성하며, 이 기록은 한국어로 유지한다.

- 고정 값·정적 목록과 표·저장 키·실행 중 고정 설정의 식별자는 **UPPER_SNAKE_CASE**를 사용한다. 이는 프로젝트 규칙이며 React·TypeScript 자체의 요구는 아니다. 모든 const 바인딩을 대문자로 바꾸지 않으며, 파생 값·Hook 결과·함수·컴포넌트·변경 가능한 store/client는 역할에 맞게 이름을 붙인다.
- 단일 컴포넌트의 정적 UI 데이터는 같은 파일에서 imports·필요 타입 다음, 컴포넌트 함수 앞에 비공개 모듈 상수로 둔다. 여러 소비자가 실제로 공유하면 feature 또는 앱 공통 담당 모듈에 named export로 두고 정의 파일에서 직접 import한다. 하나의 거대한 constants.ts, 배럴, 웹↔확장 소스 교차 import를 권장하지 않는다.
- 고정 STATUS_LABELS 표와 props로 선택하는 label을 구분한 나쁜/권장 예제, 실제 여러 화면이 공유한다는 조건의 pagination 모듈 예제를 추가했다. locale·theme·권한·callback 의존 값은 반응하는 위치에 유지한다. 예제의 수치는 앱 정책을 새로 지정하지 않는다.
- as const·readonly·satisfies의 타입 검사와 런타임 불변성·외부 값 검증을 구분했다. 공유 배열·표를 수정하거나 편집 state가 공용 템플릿을 변경하지 않도록 했다. 기존 타입 예제의 titleModes·titleModeLabels도 TITLE_MODES·TITLE_MODE_LABELS로 바꾸고 readonly literal 추론을 적용했다.
- 기존 env.ts의 환경변수 검증·기본값, storageService.ts의 STORAGE_KEYS 문자열, API 경로·메시지 ID를 보존하도록 명시했다. 이름·위치 정리가 동작 변경을 승인하지 않는다. 기존 env 등의 명명이나 각 컴포넌트 내부 표를 이번에 일괄 수정하지 않았으며, 자동 lint 강제도 추가하지 않았다.

공식 TypeScript의 const 선언·const assertions·satisfies 영문 원문과 React의 렌더 순수성 문서를 확인했다. 양 앱의 실제 TypeScript 6.0.3, React/타입 19.3.0 및 설정과 대조했다. 새 코드 블록 4개와 변경된 타입 예제 1개, 누락된 키·readonly 객체 쓰기·readonly 배열 변경 대조 3개를 양 앱 설정으로 확인해 **16개 기대 결과가 일치**했다. import 예제의 대상 모듈은 실제 @ 경로 설정이 가리키는 위치에 컴파일러의 가상 파일로 제공했다. Node 24.15.0에서 문서 예제만 확인했으며, 앱 전체 lint/build·브라우저 동작·성능 측정은 수행하지 않았다.

독립 검토는 단일 UI 표, 동적 번역/권한/콜백, 공유 API·저장 키, 편집 템플릿, 같은 숫자의 서로 다른 의미 등 5개 상황에 규칙을 적용했다. TypeScript 스킬 설명의 외부 데이터 검증 검색 단서도 유지했다. 스킬 구조·문서 내부 링크·영문 여부·원본 판정표 보존을 확인했다. 애플리케이션 코드는 변경하지 않았다.

참고자료 구성은 [OpenAI의 supporting resources 안내](https://developers.openai.com/plugins/build/skills)와 [2026년 9월 11일 지침 재검토 글](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)에 따라, 짧은 진입점에서 관련 판단 자료를 선택해 읽도록 유지한다. 상수는 독립 주제의 새 파일로 추가했지만, 당시에는 기존 reference의 분할·재배치를 사용자와 상의하기 위해 보류했다. 후속 분할은 단순 줄 수보다 서로 다른 작업에서 독립적으로 읽는지로 결정하고, 적용 조건·예제·예외는 함께 둔다. 당시 state-and-identity.md와 react-type-contracts.md를 검토 후보로 기록했다. 후속 검토와 승인에 따른 재구성은 아래에 기록한다.

## 독립된 판단 주제별 참고자료 재구성

2026-09-25, 사용자가 검토한 재구성안의 적용을 승인했다. 파일 길이만으로 나누지 않고, 다른 작업에서 독립적으로 읽을 수 있는 판단 단위를 분리했다. 사용자가 제외한 공식 Playwright 스킬은 이번 검토·복사·검증·편집 대상에서 모두 제외했다.

| 기존 자료 | 재구성한 소유 범위 |
| --- | --- |
| React state-and-identity | 초안·컴포넌트 identity·key·ref는 함께 유지하고, 공통 타입·나쁜/권장 업데이트·예외·검증은 [immutable-state-updates](../.agents/skills/react-patterns/references/immutable-state-updates.md)로 이동했다. ES2022 정렬 제약도 불변 갱신 자료가 소유한다. |
| React 타입 계약 | [component-type-contracts](../.agents/skills/typescript-standards/references/component-type-contracts.md)는 함수 선언·props·mode별 필수 callback을, [state-type-modeling](../.agents/skills/typescript-standards/references/state-type-modeling.md)은 초기 추론·상태 union·payload·exhaustive 분기를 담당한다. 기존 파일은 내용 이동 후 제거했다. |
| React performance | [memoization-decisions](../.agents/skills/react-patterns/references/memoization-decisions.md)에 세 API의 적용 조건·반례·의존성·측정 기준을 모았다. 요청·번들·캐시·브라우저 작업 등 나머지 성능 기준은 기존 performance에 유지했다. |
| Effect Event 상세 | correctness에는 적용 조건과 링크를 두고 호출 허용 범위·의존성 계약은 기존 effect-event-boundaries로 통합했다. |
| 타입 단언·상수 예제 | 일반 any·단언 원칙은 TS SKILL에 유지하고, 고정 tuple·lookup의 checked literal 예제는 constants로 이동했다. 초기값 단언이 미래 상태 타입을 대신하지 못한다는 예외는 상태 모델링 자료에 보존했다. |
| Query | 파일을 추가하지 않았다. 조회·캐시 기본, mutation callback, 재검증을 포함한 완료, 낙관적 쓰기 경쟁을 절별로 선택해 읽도록 연결했다. |

AGENTS와 React·TypeScript·상태 관리 SKILL, 관련 reference와 이 감사 기록의 링크를 새 소유 위치로 갱신했다. 컴포넌트 선언만 바꾸는 작업이 상태 타입 전체로, 불변 갱신 작업이 초안·key 전체로 자동 연결되지 않도록 읽기 조건을 좁혔다. 공식 근거와 적용 버전은 각 판단 자료에 남겼다.

검증에서 대상 5개 프로젝트 스킬의 코드 블록 **53개가 이동 전후 내용·개수 모두 동일**함을 확인했다. 공통 타입·예외·관찰 검증도 해당 예제와 함께 보존했다. 문서 25개의 로컬 경로·절 anchor·코드 펜스·언어·공백, 변경된 스킬 3개의 공식 구조 검증을 통과했다. 원본 판정표 82개 항목과 앱 소스·설정·README 266개 파일은 그대로 유지했다. 독립 적용 검토에서는 props 계약, 중첩 상태 갱신, callback 메모이제이션, 조회 전용 Query 변경의 네 상황에 필요한 자료만 선택할 수 있었고 필수 판단 누락이나 연결 오류를 발견하지 않았다. 코드와 라이브러리 API를 바꾸지 않아 이전 타입 검사·동작 검사와 앱 lint/build는 반복하지 않았다. 이 결과는 문서 보존·연결·판단 경계 확인이며 실제 토큰 사용량이나 코드 품질 개선을 측정한 결과가 아니다.

## React 조합·네이티브 계약·오류 경계 보강

2026-09-25, 사용자가 제공한 [React 패턴 9가지 글](https://devloo.tistory.com/entry/React리액트-React-개발자라면-반드시-알아야-할-디자인-패턴-9가지), [React 글 목록](https://www.testnguide.com/blog/react), [고급 TypeScript 패턴 글](https://www.testnguide.com/blog/react/advanced/24-typescript-react-patterns)을 검토한 뒤 적용을 승인받았다. 9가지 패턴 글과 고급 TypeScript 글은 전체를 읽고, 목록의 25개 주제를 확인한 뒤 ref·children 조합·Context·Suspense/ErrorBoundary·다형성과 접근성 글을 추가로 읽었다. 모든 글과 모든 예제를 감사한 것은 아니다. 블로그를 규범으로 복사하지 않고 관련 공식 영문 문서와 현재 설치 API·타입을 대조했다.

### 판단별 반영 위치

| 판단 | 적용 위치와 범위 |
| --- | --- |
| 네이티브 props·ref·접근성 | [native-element-contracts](../.agents/skills/typescript-standards/references/native-element-contracts.md): 허용한 속성의 실제 전달, 자체 props 충돌, className·이벤트 결합, React 19 ref prop, label·키보드·포커스, Slot/asChild의 계약을 정리한다. 기존 forwardRef를 일괄 제거하지 않는다. |
| 컴포넌트 조합 | [component-composition](../.agents/skills/react-patterns/references/component-composition.md): children, render prop, compound component, 조건부 HOC/props getter의 선택 기준을 정리한다. Children/cloneElement의 취약성과 대안을 설명하되 라이브러리 내부 구현까지 금지하지 않는다. |
| 오류 경계와 Suspense | [error-boundaries-and-suspense](../.agents/skills/react-patterns/references/error-boundaries-and-suspense.md): 처리 가능한 오류와 이벤트/비동기 작업의 책임을 구분하고, fallback 해제와 실제 재요청·복구를 분리한다. AGENTS와 TS 선언 규칙에 직접 구현하는 클래스 ErrorBoundary의 좁은 예외를 명시했다. React.FC 금지는 유지한다. |
| Context | [context-boundaries](../.agents/skills/state-management/references/context-boundaries.md): Provider 필수 계약과 의도된 기본값, 소비자 업데이트, 범위 선택을 정리한다. 무조건적인 Context 분할·메모이제이션이나 Zustand 대체를 요구하지 않는다. |
| 제네릭·판별 유니온·배타적 props | [component-type-contracts](../.agents/skills/typescript-standards/references/component-type-contracts.md): 실제 입력·callback의 타입 관계만 제네릭으로 표현하고, never는 제품 계약상 배타적인 경우에 사용한다. href와 onClick을 보편적인 금지 조합으로 취급하지 않으며 현재 exactOptionalPropertyTypes 설정의 한계를 명시한다. |
| 초기값·controlled 값·reset·reducer | [state-and-identity](../.agents/skills/react-patterns/references/state-and-identity.md): 초기값과 현재값, 명시적 reset 계약, 순수한 초기화, 복잡한 로컬 전이의 reducer 선택을 보완한다. 값싼 초기값의 lazy 처리나 전역 store 전환을 강제하지 않는다. |
| Custom Hook | [effect-decisions](../.agents/skills/react-patterns/references/effect-decisions.md): 하나의 소비자라도 목적을 명확히 하는 추출은 가능하며 Hook 재사용은 로직 공유이지 자동적인 상태 공유가 아님을 보완한다. |
| Query의 Suspense | [tanstack-query](../.agents/skills/state-management/references/tanstack-query.md): 웹의 Query 5.103.2 옵션 객체 API, 캐시가 있는 재조회 오류, reset·재시도의 연결과 적용 제약을 다룬다. 확장에 Query를 설치하거나 기존 조회를 Suspense로 일괄 변경하지 않는다. |

새 참고자료 4개는 각각 독립적으로 읽을 판단 주제이며 기존 React·TypeScript·상태 관리·Tailwind 진입점에서 해당 작업일 때만 연결한다. Extensible Styles는 기존 CVA·cn·Tailwind 규칙을 유지한다. HOC·props getter·범용 as 다형성은 기본 설계로 강제하지 않는다. 예제의 타입 검사 통과를 HTML 의미·접근성·성능의 보장으로 취급하지 않는다.

양 앱의 React/React 타입 19.3.0·TypeScript 6.0.3, 웹 Query 5.103.2, 확장의 직접 Slot 1.3.3과 대조했다. 웹에는 Slot 직접 의존성이 없으므로 전이 패키지의 내부 경로 import를 권장하지 않는다. 활성 지침은 영어, 이 적용 기록은 한국어로 유지한다. 공식 Playwright 스킬은 이번 작업에서 읽거나 수정하지 않았다.

### 이번 보강의 검증 결과와 한계

- 새 예제와 호출 계약을 현재 모듈 TypeScript 설정으로 검사해 **56개 기대 결과**가 일치했다. TS props·ref·제네릭·배타적 속성 44개, Context·Query API 8개, React 조합·reducer 예제 4개이며 오류가 나야 하는 사례와 컴파일되어야 하는 사례를 구분했다.
- reducer는 동결된 이전 snapshot 보존, 선택한 항목/다른 항목 제거, 추가·제거 순서, 동일 입력의 반복 평가와 ID 생성 위치를 포함한 **8개 동작 사례**를 확인했다.
- 독립 에이전트가 TextField·button/link 계약, 필수 Editor Context, lazy/저장/Query 실패 복구의 **세 요청**에 새 지침을 적용했다. 판단을 바꾸는 충돌은 발견하지 않았다. 실제 lazy 복구 방식과 초안 소유 위치는 관련 기능 구현 시 코드에서 확인해야 할 정보로 남겼다.
- 문서 **29개**의 로컬 링크·절 anchor·영문 여부·코드 펜스·공백과 변경 스킬 **4개**의 공식 구조 검증을 통과했다. 기존 예제 **53개**를 바꾸지 않고 새 코드 블록 **9개**를 추가했다. 원본 감사표 **82개 항목**, 앱 소스·설정 **211개 해시**와 기존 README는 보존했다.
- Query API 설명의 중복을 줄여 상세 소유 위치를 상태 관리 참고자료로 통합했다. ErrorBoundary 참고자료는 오류의 소유권과 복구 판단을 담당한다. 초기화 함수의 순수한 지역 객체·배열 생성까지 금지하는 것으로 읽힐 수 있는 문장도 좁혔다.
- 검사는 임시 경로에서 Node **24.15.0**으로 실행했다. 프로젝트 지정 Node 26.10.0의 앱 전체 lint/build, 실제 브라우저의 label·ref·키보드·재시도, 서버 저장, 성능·오판 감소 측정은 수행하지 않았다. 애플리케이션 소스·의존성·lint/컴파일러 설정은 변경하지 않았다.

## UI와 비즈니스 로직의 분리 기준 보강

2026-09-25, 사용자가 승인한 책임 분리 기준을 [UI와 비즈니스 로직 참고자료](../.agents/skills/react-patterns/references/ui-and-business-logic.md)에 추가했다. 기존 일반 원칙만으로는 모호했던 컴포넌트·일반 TypeScript 함수·목적별 Hook·API/service 사이의 배치 판단을 정리했다. 활성 지침은 영어, 이 기록은 한국어로 유지한다.

- 컴포넌트는 JSX·접근성·표시와 단순 UI 상호작용, 일반 함수는 React 없이 표현할 수 있는 정책·계산, Hook은 필요한 React 상태·생명주기와 기능 흐름, API/service는 기존 통신·저장·외부 검증 계약을 담당한다. 이 분류가 모든 기능에 네 계층이나 네 파일을 요구하지 않음을 명시했다.
- 책임의 변경 이유, 실제 여러 소비자의 일관성, 독립적으로 확인할 의미 있는 판단을 분리 근거로 삼는다. 한 소비자도 추출할 수 있지만, 줄 수·가상 재사용·Hook이라는 이름만으로 분리의 품질을 판단하지 않는다.
- 열기·닫기, 짧은 상태 label, 입력 이벤트에서 값 꺼내기, 단일 화면의 단순 표시용 필터링은 지역 UI에 유지할 수 있다. 모든 비-JSX 코드를 거대한 usePageLogic으로 옮기거나 Container/View 파일 쌍을 강제하지 않는다.
- 실제 웹의 note Query/feature service 및 draft API 직접 호출 경로, 확장 검색 store의 service 호출·pending/error/cache 소유를 확인했다. 모든 조정을 Hook으로 옮기거나 service를 새로 추가하도록 강제하지 않는다. 기존 인증 복구·검증·캐시·실패 의미를 보존하고 기존 구현을 완전한 모범 사례로 간주하지 않는다.
- 순수한 제목 변경 판단과 이를 표현하는 버튼을 두 개의 설명용 파일로 나눴다. trim·빈 제목 거부·동일 제목 처리 정책은 예제의 명시적 전제이며 현재 앱의 정책을 변경하지 않는다. callback 요청, 비동기 작업 완료, 실제 저장 성공을 구분하고 경쟁 요청과 초안 보존은 기존 명령 소유자가 처리하도록 연결했다.
- AGENTS와 React·TypeScript·상태 관리 진입점에 조건부 링크를 추가했다. Effect 참고자료에는 실행 시점/시작 주체의 구분과 코드 책임/파일 배치의 구분을 설명해, render 중 계산하는 함수를 반드시 컴포넌트 본문에 구현해야 한다는 오해를 방지했다.

근거는 React 공식 영문 자료의 컴포넌트 책임, Custom Hook 추출과 일반 함수, 이벤트 간 로직 공유다. React/타입 19.3.0·TypeScript 6.0.3·Zustand 5.0.15 및 웹 Query 5.103.2의 manifest·lockfile·설치본과 현재 컴파일러 설정을 대조했다. 새 아키텍처나 의존성·앱 코드는 추가하지 않았다. 이미지 최적화, Lighthouse/Web Vitals, Bundle Analyzer 지침은 이번 범위에 포함하지 않았고 Playwright 스킬도 읽지 않았다.

### 분리 기준의 검증 결과

- 문서의 정확한 TS/TSX 코드 블록 두 개와 정상 UI·비 UI 호출자를 양 앱의 원래 tsconfig 옵션·별칭·타입으로 함께 검사했다. 정상 구성 **2회** 통과, 잘못된 제목 타입·콜백 인자 타입의 거부 **4회**가 기대한 오류와 일치했다.
- 양 앱의 설치된 Hooks rules-of-hooks·exhaustive-deps 검사 **2회**에서 오류·경고가 없었다. 순수 함수는 빈 값, 공백, 동일 값, 정규화 후 동일/변경 값, 저장된 문자열의 비교 의미, Unicode를 포함한 **7개 사례**를 확인했다.
- 독립 적용 검토는 작은 팝업, 웹 이름 변경의 초안·완료 소유권, 확장 검색의 기존 store 경계 **세 상황**에서 과도한 추출이나 상태 복제를 요구하지 않음을 확인했다. 예제의 void callback이 오류 처리를 증명하지 않는다는 한계와 실제 정책 확인 조건도 검토했다.
- 문서 **30개**의 로컬 링크·anchor·영문 여부·코드 펜스·공백, 변경 스킬 **3개**의 공식 구조 검증을 통과했다. 기존 코드 블록 **62개**를 보존하고 새 예제 **2개**를 추가했다. 원본 감사표 **82개 항목**, 앱 소스·설정·모듈 README **213개 해시**와 루트 README를 보존했다.
- 검사는 임시 경로에서 기존 Node **24.15.0**으로 수행했다. 전체 앱 lint/build·브라우저·실제 비동기 저장·접근성·영속성·성능을 검증한 것은 아니다. 이미지와 성능 도구의 상세 지침도 추가하지 않았다.

## 저장·세션·확장 실행·입력 상호작용의 6가지 기준 보강

2026-09-25 사용자가 승인한 6가지 항목을 독립적으로 읽는 영문 reference로 추가했다. 환경 변수·로그와 URL 상태·탐색 이력은 추가 후보로만 남기며 이번 지침에는 도입하지 않았다. 실제 앱 코드, 저장/삭제 정책, 상태관리 구조, 권한, 의존성은 변경하지 않았다.

| 승인 항목 | 반영 위치 | 구체화한 판단 |
| --- | --- | --- |
| 자동 저장과 저장 완료 구분 | [save-lifecycle.md](../.agents/skills/state-management/references/save-lifecycle.md) | 예약·전송·서버 확인 및 제출 revision 구분. cancel/flush의 반례, 닫기·삭제·대상 전환, Beacon/keepalive의 확인 한계. |
| 세션 전환 데이터 격리 | [session-data-boundaries.md](../.agents/skills/state-management/references/session-data-boundaries.md) | 화면 reset과 cache 폐기 구분. dispatch/retry 이전부터 세션 소유권 확인, 늦은 성공·실패·finally·refresh·mutation 처리, 공개 cache와 초안 정책 보존. |
| 확장 프로그램의 동시 저장 | [extension-storage-concurrency.md](../.agents/skills/state-management/references/extension-storage-concurrency.md) | 두 get→수정→set의 덮어쓰기 타임라인. 단일 writer의 비동기 직렬화, onChanged의 한계, 실패 전파와 단순 설정의 마지막 쓰기 허용 조건. |
| MV3 worker 종료·복구 | [extension-worker-lifecycle.md](../.agents/skills/state-management/references/extension-worker-lifecycle.md) | worker와 작업의 수명 구분, 필요한 listener 동기 등록, 재시작/복구 정책, 완료 불명 외부 쓰기, 타이머·alarms·브라우저 지원 범위. |
| 모달·오버레이 포커스 | [modal-focus-contracts.md](../.agents/skills/react-patterns/references/modal-focus-contracts.md) | 모달/비모달/alert 구분, 초기 포커스·순환·배경 차단·복귀, 중첩 Escape, 닫힌 retained panel과 Shadow DOM/portal 경계. |
| IME 입력과 키보드 명령 | [ime-keyboard-commands.md](../.agents/skills/react-patterns/references/ime-keyboard-commands.md) | 조합 입력과 Enter/Escape 명령 구분, handled event와 capture 순서, 동기 controlled input 갱신, standalone 예제의 적용 범위와 실제 OS IME 확인. |

React·state-management 진입점에서 조건별로 연결했다. 기존 native 계약·직접 요청 수명·브라우저 검증 문서도 해당 주제의 reference로 연결한다. `AGENTS.md`는 이미 관련 스킬과 데이터 보존 원칙을 안내하므로 같은 세부 규칙을 다시 나열하지 않았다.

공식 영문 자료와 현재 manifest·lockfile·설치 구현/타입을 대조했다. 기준은 React/타입 19.3.0, TypeScript 6.0.3, Query 5.103.2, Zustand 5.0.15, lodash-es 4.18.1, frontend Radix AlertDialog 1.1.23, extension polyfill 0.12.0 및 타입 0.12.6이다. Chrome 문서의 최신 alarms 옵션은 설치 wrapper 타입과 지원 버전이 다를 수 있어 복사 예제 대신 runtime·타입·권한을 함께 확인하도록 했다. 현재 manifest의 alarms 권한·최소 Chrome 버전은 변경하지 않았다.

### 이번 6가지 보강의 검증과 한계

- IME 예제를 두 앱의 설치 TypeScript 6.0.3과 앱 설정에 맞춰 확인했다. 정상 예제 2건은 통과하고 잘못된 value/callback 타입의 호출자 4건은 예상대로 거부됐다.
- 각 앱에서 조합 Enter/Escape, 이미 처리된 Enter/Escape, 일반 Enter/Escape, 일반 문자, 즉시 입력 갱신의 8개 분기를 확인했다. 총 16건은 문서 예제의 합성 handler 검사이며 DOM·OS IME 재현 결과가 아니다.
- 설치 Lodash/Query의 API 실험 5건이 통과했다. void callback의 flush 미대기, 이미 시작한 요청의 cancel 비중단, Promise 반환 flush, 예약 호출 취소, Query clear 후 기존 mutation callback의 cache 재생성을 확인했다.
- 다른 작성자가 만든 reference에 대해 3가지 독립 적용 시나리오를 검토했다. 저장 중 편집·계정 전환, 여러 실행 컨텍스트의 저장과 worker 복구, 중첩 모달/비모달의 IME·포커스 판단에서 강제 구조 변경이나 blanket 취소/영속화를 요구하지 않았다. worker 타임라인의 복구 조건을 더 명확히 했다.
- 36개 지침 문서의 상대 링크·anchor·새 reference 접근 경로와 기존 코드 블록 64개 및 원본 판정 82행의 보존을 확인했다. 영향받은 스킬 4개의 공식 구조 validator도 통과했다. 기본 Python에 PyYAML이 없어 기존 캐시의 PyYAML을 사용했으며 프로젝트 의존성은 추가하지 않았다.
- 앱·설정·모듈 문서와 루트 README/AGENTS의 267개 파일 해시가 유지됐다. 전체 앱 빌드, 실제 서버 저장, 브라우저 worker 중단/복구, 실제 OS IME·접근성 동작은 이번 문서 작업에서 실행하지 않았다.

## 클라이언트 설정·진단 정보와 URL 상태 기준 보강

앞선 6가지 보강 이후 사용자가 추가 승인한 두 후보를 2026-09-25 기존 영문 참고자료에 반영했다. 별도 reference를 추가하지 않고 관련 주제의 절과 진입점 링크를 보강했다.

- [외부 데이터 참고자료](../.agents/skills/typescript-standards/references/external-data.md#client-configuration-and-sensitive-diagnostics): Vite 클라이언트 설정의 공개 경계, 비밀값과 공개 OAuth client ID·인증정보 없는 API 주소의 구분, 전체 오류 객체·message·cause의 민감정보 가능성, 필요한 진단 필드 선택, 원래 실패 의미와 기존 로깅 경로 보존. 판단표 3개를 추가했다.
- [React 상태·정체성 참고자료](../.agents/skills/react-patterns/references/state-and-identity.md#url-owned-state-and-navigation-history): 검증된 URL 값의 소유권, 임시 입력 draft와 URL 적용값의 구분, search 필드의 유지/초기화/제거, push/replace 및 직접 진입 후 닫기 계약. 판단표 4개를 추가했다.
- TypeScript·React·state-management의 진입점과 URL 검증 절에서 필요한 절을 선택적으로 읽도록 연결했다. 모든 상태의 URL 이전, 모든 history replacement, 로그 일괄 금지, 새 로깅·telemetry 도입을 요구하지 않는다.

현재 Vite 8.3.0과 frontend `@tanstack/react-router` 1.170.39, 실제 해석된 router-core 1.171.32, Zod 4.6.5 및 TypeScript 6.0.3을 manifest·lockfile·설치 공개 타입/구현과 공식 영문 자료로 대조했다. `.env` 실제 값은 읽지 않았다. API-key 출력은 기존 JSDoc 사용 예제의 검토 대상으로 연결했으며 실제 유출을 관찰했다고 주장하지 않는다.

검증 결과와 범위:

- 설치 Router의 location 구성 3건, 공개 memory history의 push/replace 2건, Zod 검색값 거부 1건이 통과했다. Node에서 Router가 서버 진입점을 해석하므로 `navigate()`의 브라우저 history commit은 이 실험으로 검증하지 않았으며, 설치 소스의 replace/push 분기로 확인했다. 실행 중 설치 패키지의 순환 의존성 경고가 있었지만 6개 assertion은 통과했다.
- 독립 적용 시나리오에서 공개 설정과 민감 오류의 구분, 실제 route에 없는 예시 필드의 무분별한 도입 방지, 기존 Back/초안 정책 보존을 확인했다. 필수 수정이 필요한 지침 충돌은 발견하지 못했다.
- 새 실행 코드 예제를 추가하지 않았다. 기존 코드 블록 65개와 원본 파일 판정 82행을 유지하고 문서 상대 링크·anchor 및 영향받은 스킬 3개의 구조를 확인했다.
- 앱·설정·모듈 문서 및 루트 README/AGENTS의 267개 파일 해시를 보존했다. 실제 비밀값을 포함한 빌드/로그, 전체 앱 빌드, 브라우저 Back/Forward·포커스·초안 저장 동작은 수행하지 않았다.

## 모델 배치와 검수 후보의 적용 범위 조정

2026-09-25 사용자 승인에 따라 기존 지침의 적용 범위를 명확히 했다. API나 애플리케이션 동작을 변경한 작업은 아니다.

- [AGENTS.md](../AGENTS.md#subagent-delegation-and-model-selection): 확인 경로가 명확한 화면·도구 간 판단은 Astra `medium`, 탐색형 UI 검증·어려운 구조 판단·미해결 결함은 Astra `high`, 필요하면 `xhigh`(Extra High)로 조정했다. 사용자가 정한 프로젝트 시작값이며 공식 기본값이나 최적값이라는 주장은 아니다. 부모 Astra Ultra와 Sol·Luna 기준은 유지했다.
- [TypeScript 진입점](../.agents/skills/typescript-standards/SKILL.md#scope-and-baseline): 다중 YAML 문서를 고려하면서 변경에 관련된 importer·해석된 패키지 항목과 설정만 확인하도록 범위를 좁혔다.
- [상수](../.agents/skills/typescript-standards/references/constants.md#review-checks-and-sources)와 [상태 타입](../.agents/skills/typescript-standards/references/state-type-modeling.md#verification): 문서 예제를 바꾸는 경우에는 해당 예제를 검증하고, 앱을 바꾸는 경우에는 변경한 선언·사용처와 관련 계약을 검증하도록 구분했다. 수정하지 않은 문서 예제의 반복 검사를 요구하지 않는다.
- [저장](../.agents/skills/state-management/references/save-lifecycle.md#observable-checks), [세션](../.agents/skills/state-management/references/session-data-boundaries.md#observable-checks), [확장 워커](../.agents/skills/state-management/references/extension-worker-lifecycle.md#verification-for-a-changed-flow): 변경한 흐름에 실제로 참여하는 소유자·수명·경계 사례를 선택하도록 명시했다. 영향을 받는 저장 순서·종료 후 보존·복구를 확인하는 기준은 유지한다.
- [색상 토큰](../.agents/skills/tailwind-styling/references/color-tokens.md)과 Tailwind 진입점: 현재 overlay의 `:host, *` 및 `.dark, .dark *` 선언을 명시했다. 자손에도 변수가 직접 선언되므로 wrapper 변경이 단순히 상속될 것이라고 가정하지 않도록 설명했다. CSS 자체를 권장 구조로 고정하거나 수정하지 않았다.

기존 코드 예제·버전 근거와 원본 파일별 판정은 보존했다. 이번 확인 범위는 문서 연결·스킬 구조·적용 조건의 일관성이며, 애플리케이션 빌드·실제 브라우저 동작·모델별 성능 비교를 새로 검증한 것은 아니다. Playwright 스킬은 읽지 않았다.

## Issue #1 최종 적용 확인과 통합 준비

2026-09-25에는 지침을 실제 작은 작업에 적용했다. [GoogleLoginButton](../frontend/secondbrain/src/features/auth/components/GoogleLoginButton.tsx)의 고정 문구 표를 같은 파일의 모듈 상단 `GOOGLE_LOGIN_BUTTON_LABELS`로 옮기고 `as const satisfies Record<GoogleLoginButtonText, string>`로 세 모드의 키를 확인했다. 공개 props, 표시 문구와 accessible name, OAuth handler, hover/pressed 스타일은 유지했다. 별도 전역 상수 파일·메모이제이션·새 의존성을 추가하지 않았다.

적용 과정에서 TypeScript·React 진입점과 상수 데이터·컴포넌트 계약 참고자료를 선택했고, 부모 에이전트가 diff와 실제 결과를 검토했다. 단순 선언 정리에 브라우저 성능 향상이나 제품 버그 해결 효과를 주장하지 않는다.

- Node **26.10.0**과 Playwright CLI **0.1.21**을 저장소 밖 임시 디렉터리에 정확한 버전으로 설치했다. 프로젝트 의존성과 기존 전역 설치는 변경하지 않았다. CLI 내부 Playwright/Core는 기존과 같은 **1.64.0-alpha-1789764292000**이다.
- 이 Node에서 웹의 설치된 TypeScript로 `tsc -b --pretty false`, ESLint로 `eslint .`, 변경 컴포넌트의 Prettier 검사를 실행했다. 모두 통과했으며 ESLint는 오류 0개, 변경하지 않은 파일의 기존 경고 18개였다. 이 변경은 번들·설정·asset 계약을 바꾸지 않아 전체 build와 의존성 설치를 반복하지 않았다.
- README에 기재된 공개 localhost 환경값 세 개를 프로세스에만 제공하고 Vite를 `127.0.0.1:5187`에 실행했다. 새 Playwright 세션에서 실제 랜딩 화면의 `Sign in with Google` 표시, 같은 accessible name, `type=button`, hover 배경 반응 및 DOM focus를 확인했다. 실제 OAuth 로그인을 실행하거나 키보드 접근성 전체를 검증한 것은 아니다.
- 처음 실행에서는 필수 환경값 누락이 명시적으로 실패했고, 문서의 값으로 재실행했다. 백엔드를 띄우지 않은 최종 확인에서도 초기 auth refresh에 `ERR_CONNECTION_REFUSED`가 기록되었다. 이는 미연결 환경의 한계로 보존했으며 실제 인증·서버 연동 성공으로 표시하지 않는다. 검증 세션과 이번에 실행한 서버는 종료했다.
- [브라우저 검증 참고자료](../.agents/skills/project-verification/references/browser-checks.md)에 프로젝트 Node 선택, CLI 버전 고정 설치, 경로·버전 확인, 공식 스킬 출처와 선택적 갱신 절차를 보강했다. 이미 추적 중인 공식 스킬 11개 파일은 읽거나 수정하지 않았다.
- [Git 반영 경계](../AGENTS.md#git-delivery-boundaries)에 승인 범위의 commit/push/PR/merge, 이슈 완료 근거와 자동 종료 연결, 병합 보존 확인 후 브랜치 정리를 명시했다.

최종 PR에는 위 적용 증거와 문서·예제 검증의 범위를 함께 기록하고 `Closes #1`을 연결한다. 저장소 반영 완료와 이슈 종료는 원격 PR 병합·이슈 상태 확인으로 판단하며, 이 준비 기록 자체를 병합 완료로 간주하지 않는다.

## 후속 작업과 기존 상태

현재 활성 훅은 `.githooks/commit-msg`이다. 비활성 `extension/.husky/pre-commit`의 `pnpm test`는 존재하지 않는 스크립트를 가리키므로 현재 필수 검증으로 안내하지 않았다. 자동 활성화나 삭제는 하지 않았다. 공통 안내는 [커밋 규칙](commit-conventions.md)과 일치한다.

검토 중 발견한 기존 렌더 부수효과·ref 쓰기·확장 시스템 테마 반응 등은 이번 문서 수정의 모범 사례로 채택하지 않았다. 현재 동작을 실제로 재현하거나 버그를 수정한 결과로 간주하지 않으며 관련 기능 작업에서 다시 확인할 후보이다.

개발 지침 정비와 작은 실제 대표 작업의 적용 확인을 마쳤다. UI/UX 전면 개편, 기존 기능의 상세 결함 수정, 실제 OAuth·백엔드·LLM 연동 QA는 Issue #1의 완료 기준에서 정한 후속 범위로 유지한다. PR 병합과 원격 완료 여부는 GitHub 기록으로 확인한다.

## 원본 파일별 판정

아래 경로는 원본 `.agents/skills/` 기준이다. 제외는 원본 삭제가 아니라 현재 프로젝트의 활성 지침에 옮기지 않았다는 뜻이다.

| 원본 파일 | 판정과 반영 방향 |
| --- | --- |
| `form-patterns/SKILL.md` | 독립 스킬 제외 — RHF+Zod 조합을 기본값으로 강제할 근거 없음. 쓰는 Zod만 TS 경계 검증 참고로 통합. |
| `form-patterns/rules/error-handling.md` | 접근성 기준만 추출 — RHF 예제 제외. label/id, aria-invalid/aria-describedby, 실패 후 값 유지, pending/성공을 실제 응답과 맞추는 기준은 React/UI 기준으로 유지 가능. cloneElement/as 단언 기반 범용 wrapper 강제하지 않음. |
| `form-patterns/rules/multi-step-forms.md` | 제외 — RHF/react-router-dom 미사용, 다단계 폼 확인되지 않음. Zod merge/refinement 전체 예제를 현재 프로젝트에 이식하지 않음. |
| `form-patterns/rules/react-hook-form.md` | 제외 — RHF/resolver 미사용. 폼 도입이나 설치 요구 없음. |
| `form-patterns/rules/validation-patterns.md` | Zod4 경계 검증 내용 추출 — RHF onBlur 기본 강제/잘못된 `<input ... onBlur />` 제거. 구 errorMap `(issue,ctx)`, invalid_string, issue.type/validation 제거. Zod4 customError, origin, invalid_format/format을 사용하거나 간결한 schema-local error로 대체. JS 서버 공통 schema 강제도 프로젝트 backend 언어와 맞지 않아 삭제. |
| `form-patterns/rules/zod-schemas.md` | Zod4 내용 추출·수정 — required_error/invalid_type_error 삭제→error. 새 예제 `z.email()`/`z.uuid()`. merge→extend 또는 object shape 조합. transform 입력/출력 타입과 invalid NaN/Date 차단. |
| `nextjs-best-practices/SKILL.md` | 제외 — Next.js 미사용. 프론트에 서버 캐싱/Server Action 규칙을 활성화하면 잘못 적용된다. |
| `nextjs-best-practices/rules/async-api-routes.md` | 제외 — Next API Routes/Server Actions 미사용. 독립 요청 병렬화는 일반 비동기 규칙에서 다루되 better-all 추가와 근거 없는 2–10배 수치를 제거한다. |
| `nextjs-best-practices/rules/async-suspense-boundaries.md` | 제외 — async 서버 컴포넌트/streaming 전제. 현재 Vite 클라이언트 렌더 함수 안에서 Promise를 매 렌더 생성하는 예시로 옮기지 않는다. |
| `nextjs-best-practices/rules/rendering-activity.md` | **수정 후 React 규칙으로 통합** — React 19.3.0 지원. state/DOM 보존이 필요한 패널에 한해 선택; hidden Effect cleanup, 재표시 시 Effect 재생성, hidden 상태 낮은 우선순위 재렌더링을 명시. 'expensive re-renders를 피한다' 보장 삭제. 메모리 보존 비용과 editor/canvas 자원 lifecycle 확인 조건. |
| `nextjs-best-practices/rules/rendering-hydration-no-flicker.md` | 제외 — SSR/hydration 미사용. DOM을 inline script로 수정하면 무조건 mismatch가 없어진다는 보장을 이식하지 않는다. |
| `nextjs-best-practices/rules/server-after-nonblocking.md` | 제외 — next/server after 미사용. 원문 async callback의 logUserAction promise 미대기 예시는 이식하지 않는다. |
| `nextjs-best-practices/rules/server-cache-lru.md` | 제외 — 서버 LRU/RSC/배포 런타임 미사용. 전역 user 캐시·any·전통 serverless 격리 일반론도 현재 프론트에 불필요하다. |
| `nextjs-best-practices/rules/server-cache-react.md` | 제외 — 요청별 서버 cache 전제. 클라이언트 TanStack Query 캐시 대체로 사용하면 안 된다. |
| `nextjs-best-practices/rules/server-parallel-fetching.md` | 제외 — RSC/async component 전제. 서버 컴포넌트가 항상 순차 실행된다는 일반화도 불필요하다. |
| `nextjs-best-practices/rules/server-serialization.md` | 제외 — RSC 서버/클라이언트 경계 없음. 현재 통신 payload 최소화와 혼동하지 않는다. |
| `react-best-practices/SKILL.md` | 교체. 전체 frontend 자동 최적화/CRITICAL 계급을 없애고 correctness + 조건부 performance로 재구성. |
| `react-best-practices/rules/advanced-event-handler-refs.md` | 수정. effect callback의 최신 값 문제만 다룸. useEffectEvent stable identity 설명은 틀림. effect 내부 호출/전달 제한/의존성 회피 금지 추가. |
| `react-best-practices/rules/advanced-use-latest.md` | 독립 규칙 제외·통합. dependency 줄이기를 목표로 삼지 말고 필요한 동기화 기준 판정. custom useLatest의 ref까지 lint가 안정성을 아는 것은 아님. |
| `react-best-practices/rules/async-defer-await.md` | 조건부 유지. 불필요한 요청 시작 회피는 유효하나 권한 검사 순서·노출 정책·필요한 병렬성을 보존. |
| `react-best-practices/rules/async-dependencies.md` | better-all 미사용 예제 제외. native Promise로 의존 관계 표현, 새 dependency 설치 요구 제거. |
| `react-best-practices/rules/async-parallel.md` | 수정. 안전하게 독립적인 작업만 동시 실행. '1 round trip', '2–10x' 보장 제거; 실패/취소/호출 제한 고려. |
| `react-best-practices/rules/bundle-barrel-imports.md` | 수정. Next/MUI 예제 제외, Lucide 공식 named import 유지 가능. 내부 dist 경로 일괄 강제/수치 일반화 제거. |
| `react-best-practices/rules/bundle-conditional.md` | 수정. 미정의 setEnabled 호출, 비활성화/해제 이후 결과 처리 보완. window check가 SSR 번들 제외 보장한다는 주장 삭제. |
| `react-best-practices/rules/bundle-defer-third-party.md` | 현재 예제 제외. Next/Vercel Analytics 미사용. 모든 오류 추적을 지연하라는 규칙은 초기 오류 수집 목표와 충돌할 수 있음. |
| `react-best-practices/rules/bundle-dynamic-imports.md` | 수정. Next/Monaco 예제를 React.lazy/Suspense로 대체. 실제 무거운 UI일 때만. |
| `react-best-practices/rules/bundle-preload.md` | 조건부 유지. import 실패 처리, 의도/네트워크 비용 판단. window check의 번들 제외 주장 삭제. |
| `react-best-practices/rules/client-event-listeners.md` | SWR 예제 제외·cleanup 기준만 통합. 중복 리스너가 실제 문제일 때 기존 subscription 경계 점검. |
| `react-best-practices/rules/client-swr-dedup.md` | 제외. SWR 미사용, frontend는 Query, extension는 자체 service 사용. |
| `react-best-practices/rules/js-batch-dom-css.md` | 수정. 각 style 쓰기가 각각 reflow라는 주장은 오류. layout read/write 교차 판정, cssText 덮어쓰기 주의. |
| `react-best-practices/rules/js-cache-function-results.md` | 조건부 축소. render 중 임의 module Map cache/auth cookie cache 권장 삭제. 수명·크기·무효화 먼저. |
| `react-best-practices/rules/js-cache-property-access.md` | 조건부 축소. hot path에서만, loop 도중 값 변경 의미 보존. |
| `react-best-practices/rules/js-cache-storage.md` | 조건부 축소. 캐시 일괄 도입 금지. storage.clear의 key=null, 동일 탭/다른 컨텍스트 변경, cookie 무효화 한계 있음. 기존 store 경계 우선. |
| `react-best-practices/rules/js-combine-iterations.md` | 조건부 축소. 가독성 저하/동작 순서 변경 대비 측정된 이득이 있을 때. |
| `react-best-practices/rules/js-early-exit.md` | 조건부 유지. 첫 오류와 마지막/전체 오류라는 반환 의미 차이를 보존. |
| `react-best-practices/rules/js-hoist-regexp.md` | 조건부 유지. 비싼 동적 regex만 memo 고려, query escape 및 g/y lastIndex 주의. render 내 regex 생성 자체 금지 제거. |
| `react-best-practices/rules/js-index-maps.md` | 조건부 유지. 중복 key는 find의 첫 값 vs Map의 마지막 값이라는 의미 차이, 구축 비용 고려. |
| `react-best-practices/rules/js-length-check-first.md` | 조건부 유지. 비교 의미가 동일할 때. toSorted는 현재 ES2022 lib에 맞춰 복사 후 sort. |
| `react-best-practices/rules/js-min-max-loop.md` | 조건부 유지. min/max만 필요할 때 단일 순회, 빈 배열 반환 계약 보존. |
| `react-best-practices/rules/js-set-map-lookups.md` | 조건부 유지. 반복 조회의 크기/횟수/구축 비용 고려, 모든 includes 변환 강제 제거. |
| `react-best-practices/rules/js-tosorted-immutable.md` | 수정. 불변성 유지. 앱 ES2022 lib에서 [...items].sort 사용 가능, toSorted 강제 불가. 브라우저 최소 버전 표는 유지 관리 근거 없이 복제하지 않음. |
| `react-best-practices/rules/rendering-animate-svg-wrapper.md` | 조건부 축소. wrapper가 GPU 가속 보장한다는 규칙 삭제. layout/접근성 유지하며 실제 브라우저 측정. |
| `react-best-practices/rules/rendering-conditional-render.md` | 유지·축소. 숫자 falsy 렌더 문제 예방, boolean &&까지 금지하지 않음. |
| `react-best-practices/rules/rendering-content-visibility.md` | 조건부 축소. 10x 수치 제거, 접근성/focus/find/스크롤·intrinsic size 검증. |
| `react-best-practices/rules/rendering-hoist-jsx.md` | 조건부 축소. 값싼 JSX 생성은 정상, 모든 static component를 module 상수로 바꾸지 않음. Compiler 미설정 명시. |
| `react-best-practices/rules/rendering-svg-precision.md` | 조건부 축소. SVGO 신규 도입/precision=1 강제 제외. 필요 시 모양 변형 확인. |
| `react-best-practices/rules/rerender-defer-reads.md` | 조건부 수정. handler가 최신 상태를 필요로 하는지 snapshot을 필요로 하는지 판단, Router의 상태 계약을 window로 우회하지 않음. |
| `react-best-practices/rules/rerender-dependencies.md` | 유지·수정. 실제 reactive read 전체를 포함하면서 필요한 primitive로 좁힘. 동기화 의미 바꾸지 않음. |
| `react-best-practices/rules/rerender-derived-state.md` | 유지·축소. width 자체가 필요 없을 때 media query 고려, 새 hook 설치 요구하지 않음. |
| `react-best-practices/rules/rerender-functional-setstate.md` | 유지·수정. 이전 state 기반 updater 정확성 유지, callback 안정성/메모리 누수 자동 해결 과장 제거. |
| `react-best-practices/rules/rerender-lazy-state-init.md` | 수정. StrictMode 재호출 가능, DOM read를 lazy init 일반 사용처로 권장하지 않음. prop 변경 자동 반영 아님, storage 파싱 실패 처리. |
| `react-best-practices/rules/rerender-memo.md` | 조건부 축소. 분기/컴포넌트 분리만으로 계산 회피 가능, memo/useMemo 일괄 추가 금지. |
| `react-best-practices/rules/rerender-transitions.md` | 수정. scroll 자체의 빈도/계산을 줄이는 도구 아님. 입력 state와 transition 구분, await 뒤 API 제약 명시. |
| `solid-principles/SKILL.md` | 독립 스킬 제외·짧은 기준 통합. 모든 함수/컴포넌트에 일률 적용하는 추상화 규칙 축소. |
| `solid-principles/rules/dip-dependency-inversion.md` | 수정·축소. 모든 API access를 interface/class/Context로 주입 강제 금지. 실제 교체/테스트 경계일 때만. form onSubmit에 credentials handler 직접 연결은 타입/행동 오류. raw fetch hook에는 error/race/cleanup 없음. vi 미설치 예제 제외. |
| `solid-principles/rules/isp-interface-segregation.md` | 핵심 유지·축소. 필요한 props만 요구. 한 필드마다 interface를 쪼개는 보일러플레이트 강제 제거. |
| `solid-principles/rules/lsp-liskov-substitution.md` | 수정·축소. 실제 공유 계약이 있는 컴포넌트만 substitutability 요구. number 입력과 text 입력에 같은 callback 계약 강제 불필요. onChange={e.target.value)} 문법 오류, 'same interface=same behavior' 과장 제거. |
| `solid-principles/rules/ocp-open-closed.md` | 수정·축소. composition 선택 가능, 기존 component 수정 자체를 나쁨으로 분류하지 않음. ButtonProps에 없는 disabled를 전달하고 실제 button에도 전달하지 않는 broken example 제거. |
| `solid-principles/rules/srp-single-responsibility.md` | 유지·축소. 변경 이유·데이터/부수효과 경계가 분리를 정당화할 때. 'and가 들어가면', 단계가 여러 개면 무조건 분리 같은 기준 제거. |
| `state-management/SKILL.md` | 재작성 — Jotai 권장 삭제. Zustand 양 앱/Query frontend 범위 명시. 모든 서버 상태를 Query로 옮기도록 강제하지 않음. |
| `state-management/rules/jotai-atoms.md` | 제외 — 미사용. Async read-only atom을 set하는 오류도 있으나 미사용 규칙을 별도 수리·설치하지 않음. |
| `state-management/rules/local-vs-global.md` | 통합·축약 — 형제 공유·영속성→무조건 Global 표, 2–3단계 props→Jotai 권장 삭제. 가까운 공통 부모·필요한 범위 원칙만 유지. |
| `state-management/rules/state-colocation.md` | 통합·축약 — “전역이면 Zustand/Jotai, Context 금지” 삭제. hover를 JS state로 만드는 예제/렌더 최적화 강제 삭제. 소유권·파생 상태 기준 유지. |
| `state-management/rules/tanstack-query.md` | frontend 참고로 재작성 — object API/initialPageParam 유지. 반환된 mutation snapshot과 `MutationFunctionContext`를 구분. isPending/isLoading 구분, 기존 설정/key 재사용, rollback 경쟁 조건 고려. 좋아요 해제에도 +1 하던 예제 제거. `<form onSubmit={데이터-handler}>` 오류 예제 제거. |
| `state-management/rules/zustand-patterns.md` | API 수정·축약 — `useStore(selector, shallow)`는 create 5 API와 불일치. `useShallow` 래핑 또는 단일 값 selector. 새 객체 selector 안정성 및 Set/Map 불변 갱신 명시. 무관한 Cart/persist 예제 삭제. |
| `tailwind-styling/SKILL.md` | v4로 재작성 — 대상 CSS entry/토큰/animation plugin 차이 명시. utility-only 금지/전부 dark variant 강제 삭제. |
| `tailwind-styling/rules/component-variants.md` | 0.7.1 유지·축약 — cva(base,config), VariantProps, compoundVariants 유효. beta API 사용 안 함. Slot 예제는 extension 직접 의존성 범위. 단순 map도 허용. |
| `tailwind-styling/rules/dark-mode.md` | v4/앱 경계 수정 — v3 config와 @tailwind 지시문 제거. frontend HSL/extension OKLCH 차이. extension 내부 Shadow DOM ThemeProvider/sidepanel 문서 구분. Next _document/SSR script 예제 제외. |
| `tailwind-styling/rules/responsive-design.md` | v4 수정·축약 — container query는 v4 내장, plugin/config 필요 없음. className 문자열 속 // 설명 제거. min-width 모델 유지, 모든 뷰포트 클래스 단계 강제하지 않음. |
| `tailwind-styling/rules/utility-first.md` | 통합·축약 — cn API 유효. 수동 클래스 정렬은 기존 Prettier로 대체. custom CSS/inline style 전면 금지 삭제. 동적 class 문자열 탐지 주의 추가. |
| `testing-standards/SKILL.md` | 제외, 공통 원칙 일부 흡수 — 미설치 Vitest/RTL 전제. 사용자 행동, 접근 가능한 대상, 독립된 재현, 최소 mocking 취지는 현재 브라우저 검증 규칙으로 재작성한다. |
| `testing-standards/rules/mocking-patterns.md` | 제외 — 도구 미사용. Query 예시의 cacheTime 및 logger는 v5에서 유효하지 않다. fake timers 예시의 delay:null은 user-event 공식 권고와 다르고 useRealTimers 정리도 빠져 있다. react-router-dom mock은 프로젝트 router와도 다르다. |
| `testing-standards/rules/test-patterns.md` | 제외, 검증 원칙 일부 흡수 — 구현 복제 테스트나 프레임워크 도입 없이 재현 가능성·독립 상태·경계 조건의 결과 검증만 채택한다. 무조건 integration 우선 같은 일반화는 줄인다. |
| `testing-standards/rules/testing-library.md` | 제외 — 미설치 RTL/user-event. 사용자 동작 관점과 접근성 취지는 브라우저 QA에만 추출. fireEvent/act를 예외 없이 오답으로 분류하는 식의 규칙은 이식하지 않는다. |
| `testing-standards/rules/vitest-setup.md` | 제외 — Vitest/jsdom/jest-dom/react-router-dom 미사용. `as any`, 전역 JSX.Element, __dirname 등 예시도 현재 엄격 TS/ESM 전제와 맞지 않아 복사 금지. |
| `typescript-standards/SKILL.md` | 교체. 모든 함수 명시 반환·모든 generic constraint 강제를 경계 중심 기준으로 완화. any 절대 금지 vs 예외 목록 모순 해소. |
| `typescript-standards/rules/explicit-return-types.md` | 수정. 추론 허용, public contract/외부 경계 명시. 전역 JSX.Element 제거. React.FC 일괄 금지 제거, Hook마다 interface/useCallback 강제 제거. |
| `typescript-standards/rules/generics-patterns.md` | 수정·축소. JSX 네임스페이스 수정, T/K 등의 예제는 frontend naming 설정과 불일치. `useFetch<T>`나 `JSON.parse` 결과의 타입 단언은 runtime 검증이 아님. race/error 미처리 예제 삭제. useLocalStorage의 stale closure와 storage 실패/함수 값 모호성을 '올바른 공용 hook'으로 권장하지 않음. |
| `typescript-standards/rules/no-any-type.md` | 수정. JSON.parse as T, response.json as ApiResponse를 'type-safe'로 부르는 설명 삭제; unknown+guard/schema. isUser가 name만 검증하면서 User 전체를 주장하는 불완전 예제 제거. |
| `typescript-standards/rules/strict-null-checks.md` | 명시적 null 처리·optional chaining·narrowing 유지. 0·false·빈 문자열을 유효한 값으로 인정하는지에 따라 nullish coalescing과 논리 OR를 선택한다. 단언이나 기본값으로 실패를 숨기지 않으며, 예제에는 현재 React/Query 타입을 사용한다. |
| `typescript-standards/rules/type-guards.md` | 수정. TS narrowing으로 불필요 as 제거, claimed shape 실제 검증. constructor(public statusCode...)는 erasableSyntaxOnly 위반. Zod 버전/API 상세는 외부 데이터 경계 참고자료에 정리하고, extension에는 직접 Zod 의존성이 없음을 명시. |
| `typescript-standards/rules/utility-types.md` | 수정·축소. filter(x => x !== null)가 안 좁혀진다는 설명은 TS5.5부터 오래됨. OptionalKeys는 required undefined union 오분류. naive deep utility의 Date/Map/function/array 한계, 단순 공용 타입 남발 제거. |
