# 웹 기반 동작 점검 및 개편 전 작업 목록

> 이 문서는 2026-09-25~26 기반 안정화 작업의 당시 조사·검증 기록이다. 아래의 `현재`, 브랜치, PR, 이슈, 미커밋 상태와 후속 작업 계획은 기록 시점의 표현이며 현재 Git 상태를 뜻하지 않는다. 이후 UI 작업과 남은 확인은 [UI/UX 개선 기록](ui-ux-refresh.md)을 참고한다. 기반 안정화의 회귀 검사를 새 UI 전체의 완료 근거로 확장하지 않는다.

- 관련 이슈: [#5](https://github.com/CometAve/Second-Brain-Personal/issues/5)
- 기준: 2026-09-25, 당시 `codex/web-foundation`. 1~3단계의 검토·구현·검증 기록이다. 당시 프런트엔드와 AGENTS.md 변경은 미커밋이었고 UI 시각 개편은 범위 밖이었다.
- 범위: `src`의 수기 TS/TSX 104개와 CSS 4개, 합계 108개를 읽었다. 자동 생성된 `routeTree.gen.ts`, SVG 원본은 제외했다. 인증/API 등 39개, 메인·공유·라우트 52개, 노트 16개를 영역별로 검토했고 `vite-env.d.ts` 1개는 통합 검토했다. 전체 파일명은 아래에 적었다.
- 현재 모듈: Node 26.10.0, pnpm 12.6.0, React 19.3.0, TypeScript 6.0.3, TanStack Query 5.103.2, Zustand 5.0.15, Axios 1.20.0, Zod 4.6.5. 설치 버전과 lockfile/public API를 확인해 적용했으며 이번 작업에서 패키지 버전을 바꾸지 않았다.

## 추가 UI 동작 QA (2026-09-25~26)

아래는 사용자가 추가로 요청한 7개 동작의 구현·검증 기록이다. 뒤의 최초 1~3단계 기록은 당시 기준선이며, 그 기록의 **조회 전용 노트·빈 AI 그래프·미병합 PR** 상태는 이 절의 결과로 갱신됐다. 새로운 시각 디자인을 합의·적용하는 대규모 개편과는 구분한다.

이 절을 기록할 당시 기반 커밋은 `4543069`, 작업 브랜치는 `codex/web-foundation`이었고 프론트엔드와 AGENTS.md는 미커밋이었다. 백엔드 PR #7(`5e4215c`)과 앞선 PR #6(`2988f5f`)은 master에 병합된 상태였다. 이는 2026-09-26의 기록이며 현재 브랜치·작업 트리 상태를 뜻하지 않는다.

### 요청 → 구현 연결 → 확인 결과

| 요청 | 구현 연결 | 수정 전 근거와 수정 후 확인 |
| --- | --- | --- |
| 1. + 한 번에 패널 한 번 열기 | `MainPage` → `DraftEditor`의 단일 `SidePeekOverlay` | Chrome에서 마운트·슬라이드 애니메이션 각각 2회 재현. 로딩/준비 상태가 같은 패널을 유지하도록 수정 후 각각 1회 확인 |
| 2. 제목 Enter → 본문 | `NoteTitleInput.onEnter` → `NoteEditorHandle.focus` → Milkdown `editorViewCtx` | 제목 줄바꿈 재현. 수정 후 줄바꿈 없이 실제 contenteditable 포커스 이동. Chrome 입력 프로토콜의 조합 중 Enter가 삽입하던 줄바꿈은 `beforeinput`의 줄바꿈만 차단해 해결했다. 조합 확정 입력 보존 → Enter 포커스 이동 → 실제 저장까지 재검증 |
| 3~5. 저장/닫기/오류 안내가 본문을 밀지 않기 | `DraftToolbar` 고정 높이 헤더 + 편집 본문 `top-28` | 기존 임시 저장에서 본문 32px 이동. 수정 후 보통/임시 저장/승격 저장/오류에서 같은 본문 y=221px. 저장 지연·503·닫기 실패를 주입해 확인 |
| 6. AI 처리 전에도 저장 노드 표시 | `useSavedGraphNodes` → `/api/notes/graph-nodes` → PostgreSQL 소유 노트; `mergeSavedNotesWithGraph`가 AI 링크만 결합 | AI worker 소비자 0인 환경에서 실제 저장 노트 표시, 새로고침, 제목 변경, 삭제 후 목록·노드 제외와 독립 GET 404 확인. AI 503에도 노드 유지, 노드 조회 갱신 503은 기존 노드와 오류 안내 유지 |
| 7. 목록에서 연 노트 편집·저장 | `NoteViewPage` → `useNoteEdit`/`NoteEditCoordinator` → PUT `/api/notes/:id` → 캐시 갱신 | 기존 조회 전용 연결을 편집 연결로 변경. 제목·본문 편집 직후 닫기 → GET 일치 → 재열기 일치. 503 실패 시 입력·화면 유지, 재시도 후 실제 저장 확인 |

### 추가 발견 분류

- **재현된 결함:** 창을 320px로 줄여도 그래프 캔버스가 2005×1323px에 남아 노드가 화면 밖으로 밀렸다. 컨테이너 ResizeObserver 크기를 ForceGraph에 전달하고 320·390·768·1280px에서 캔버스와 뷰포트 너비 일치를 확인했다. 좁은 화면의 검색/메뉴 헤더와 패널 위치도 같은 너비에서 확인했다.
- **재현된 결함:** 320px API Key 관리 제목이 x=-128px로 잘렸다. 메뉴 최대 너비와 입력 flex 최소 너비를 제한해 제목·발급·입력·표시/복사 버튼이 화면 안에 위치함을 확인했다. 실제 키 발급은 하지 않았다.
- **재현된 결함:** 편집 화면을 닫으면 포커스가 body로 사라졌다. 라우트 DOM 교체와 disabled 해제 이후 연결된 버튼으로 포커스를 돌리도록 수정했다. 새 초안은 +, 목록에서 연 노트는 패널 닫기 버튼으로 복귀를 확인했다.
- **코드상 위험:** 조합 중 뒤로 가기에서 아직 dirty가 아닌 입력이 저장 대기를 건너뛸 수 있었다. 기존 노트 이동 전에 조합 완료를 기다리도록 수정했다. Chrome 입력 프로토콜로 `ㅎ` 조합 → Back → 패널 유지 → `한글입력` 확정 → 서버 GET의 최종 본문 일치를 확인했다. popstate 주소는 먼저 바뀌므로 패널 종료/저장 여부로 판정했다.
- **코드상 위험, 장애 주입으로 검증:** 브라우저 복구 저장소와 서버 저장이 모두 실패한 초안의 이탈 경로를 보완했다. 정상적인 복구본이 있으면 기존 Back 동작을 유지하며, 유일한 입력본만 남으면 초안 저장을 시도하고 실패 시 화면을 유지한다. Storage 쓰기 실패+HTTP 503을 주입한 Chrome에서 SPA Back 차단·입력 보존과 native beforeunload 경고를 확인했다. 경고 취소 후 입력이 유지됐고, 복구본 재생성 후 Back·재열기·명시적 초안 삭제가 정상 완료됐다. 저장 재시도 후 실제 노트 86의 GET 일치도 확인했다.
- **UX 개선:** 기존 노트 삭제 실패가 고정 헤더와 토스트에 중복 표시됐다. 헤더의 오류 안내로 통합했으며 실패 뒤 입력 보존과 재시도 삭제를 확인했다.

### 검증 범위와 한계

- 실제 로컬 서버: 별도 QA 계정의 생성·Redis 임시 저장·DB 승격·GET 재조회·목록 열기·PUT 수정·재열기·DELETE·GET 404·노드 목록 동기화를 확인했다. 계정 인증은 기존 합성 QA 인증 경로이며 Google OAuth를 실행한 결과가 아니다.
- 실제 Chrome 조작 + 응답/환경 주입: 저장/삭제/AI/노드 조회 503, 승격 응답 지연, 초안·노트 불러오기 실패 후 같은 패널에서 재시도, 키보드 Tab/Shift+Tab 포커스 제한, 중첩 삭제 확인창 Escape, 사이드 보기 크기 조절, 4개 너비의 편집 버튼·본문 위치를 검증했다. 기존 노트의 undo/redo, 빈 제목·65자 제목의 저장 거부와 입력 보존, 유효한 제목으로 재시도도 확인했다. 오류 주입은 실제 서버 장애로 분류하지 않는다.
- 한글: 합성 composition 이벤트와 Chrome DevTools `Input.imeSetComposition`/`Input.insertText`로 조합·확정·저장·이동 경계를 확인했다. macOS 컴퓨터 도구가 일반 사용자 Chrome 창만 선택해 QA 창의 운영체제 한글 입력기 자체는 실행하지 못했다. 실제 OS 입력기 조합과 클립보드의 리치 텍스트 붙여넣기 전체를 검증했다고 주장하지 않는다.
- 그래프: 저장 노드·hover·클릭·창 크기 변경은 실데이터로 확인했다. AI 연결 데이터의 오래된 제목/삭제된 끝점/10건 초과 결합은 합성 파서 검사이며, AI worker와 외부 LLM은 켜지 않았다. 초기 60개였던 대기 메시지는 QA 생성 이벤트로 늘 수 있으나 소비하거나 외부로 전송하지 않았다.
- 기존 유효한 인증/세션/경쟁 검사는 아래 기록을 재사용했다. 변경된 메인 레이아웃의 선택·삭제·포커스 검사는 24항목을 다시 통과했다. 그래프 파서·결합 추가 후 API 검사는 24항목, 기존 노트 저장 coordinator는 7항목, 이탈 보호 추가 후 초안 coordinator는 14항목을 통과했다. 독립 정적 리뷰에서 저장/삭제 완료가 이탈 가드에 막히지 않고 복구본이 사용자별로 구분됨을 확인했다.
- 웹 전체 `tsc -b`·ESLint·Vite production build가 통과했다. 린트는 기존 공유 UI/반응형 Hook 경고 11개, 빌드는 기존 Graph/Milkdown 큰 청크 경고가 남는다. 로컬 pnpm 실행 파일이 ENOEXEC를 반환해 Node 26.10.0과 설치된 동일 도구 바이너리로 실행했다. 마지막 제목 조합 경계 변경 후 타입 검사·해당 파일 린트·포맷·production build와 Chrome 저장 회귀도 통과했다.

실제 QA 노트 55·82는 생성 당시 내용이 변하지 않았음을 확인한 뒤 UI로 삭제하고 GET 404를 확인했다. 노트 83도 실패→재시도 삭제와 GET 404를 확인했다. 추가 검증 노트 84·86·87과 이탈 보호 검증 초안도 삭제·404를 확인했다. QA B의 노드 목록은 비었고 복구 키가 남지 않았다. 이번 목표에서 만든 것으로 확정할 수 없는 노트 51은 건드리지 않았다. 기본 외부 Chrome `sb-foundation`은 유지하고 응답/계정 격리용 임시 세션 `sb-ui-errors`는 모든 검증이 끝난 뒤 닫았다. 사용자 창과 탭은 닫지 않았다.

## 검증 기준선과 한계

부모 작업의 기준선에서 로컬 백엔드 서비스 6개가 정상 상태였고 웹 빌드가 통과했다(`tsc` 포함). 린트는 오류 0개, 기존 경고 18개였으며 빌드는 큰 청크 경고를 냈다. 외부 headed Chrome 세션에서 합성 A/B 계정을 백엔드 SQL 인증 코드와 토큰 교환으로 만들고 실제 쿠키 갱신까지 확인했다. 이는 Google OAuth 로그인 자체를 실행한 결과가 아니다. 합성 테스트 계정·토큰 파일은 이 문서에 기록하지 않는다.

실제 서버에서 다른 계정의 알려진 draft UUID에 대한 POST가 **201로 성공해 원본 사용자의 초안을 덮어썼다**. 즉시 닫기 흐름에서는 저장된 초안의 제목이 보이지만 에디터 본문이 비었고, 제목을 수정한 직후 닫으면 promotion이 이전 제목으로 201을 반환했다. 이후 GET으로 조회한 영구 노트에도 이전 제목·본문이 남았으며 draft GET은 404였다. 최신 입력의 손실을 관찰한 것이다. 최근 노트가 없는 실제 응답은 `success:true`이고 `data`가 없었다. 현재 `useRecentNotes`는 이를 `undefined`로 Query에 반환해 콘솔 오류를 냈다. 노트 생성 뒤 최근 목록 캐시도 갱신되지 않았다. 같은 version 1의 동시 draft POST A/B가 모두 201과 version 2를 반환한 경쟁도 실제 서버에서 확인했다. 최근 목록에서 A를 선택한 뒤 일치하지 않는 검색어를 넣으면 “검색결과가 없습니다”가 보이지만 “선택 항목 삭제”는 계속 활성화됐다. 외부 Chrome에서 체크박스에 Space, Enter를 순서대로 입력했을 때 선택 상태는 false → true → false로 정상 전환됐다. 중첩 버튼 구조의 개선 필요성과 별개로 중복 토글은 재현되지 않았다. 그 밖의 삭제·실패 흐름 중 일부는 아직 브라우저 확인이 남았다. AI API는 Compose에서 AI 서비스만 기동해 `/ai/health`를 확인했다. 실제 그래프 조회는 합성 사용자에 대해 HTTP 200과 빈 nodes/links를 확인했고 워커·유료 LLM 호출은 실행하지 않았다. 외부 OAuth도 실행·검증하지 않았다. 기존 영구 노트 상세에서 본문을 바꾸고 닫은 뒤 재진입했을 때 원문으로 돌아가는 동작도 Chrome에서 확인했다. 같은 합성 노트는 Chrome의 확인 대화상자를 거쳐 삭제한 뒤 API 재조회가 404임을 확인했다. 조회 전용 표시는 이번 기반 정비에 포함하고, 기존 노트의 수정·저장 기능 추가는 UI 개편 때 결정한다. UI 시각 개편은 시작하지 않았다.

백엔드 선행 수정은 [PR #6](https://github.com/CometAve/Second-Brain-Personal/pull/6), 당시 `94d367c`에 기록했다. 별도 작업 트리에서 단위 테스트 70개와 전체 통합 테스트가 통과했고, 마지막 Lua 순서 변경 뒤 초안 생명주기 통합 테스트 13개가 통과했다. 부모는 최종 실행 JAR의 연산 순서를 확인한 뒤 실제 HTTP로 소유권 거부(403), 같은 버전의 한 건 성공/한 건 충돌(201/409), 같은 noteId를 반환하는 승격 재시도(201/200), 삭제 후 늦은 저장 거부(409)와 재조회 404를 확인했다. 이 문단의 원래 미병합 상태는 당시 시점이며, 위의 추가 QA 기록 시점에는 병합돼 있었다.

백엔드 잔여 한계: 삭제 기록은 24시간 보호이며, 처리 중 프로세스가 종료되면 promotion 재시도 또는 스케줄러 재처리 전까지 저장 충돌이 지속될 수 있다. PostgreSQL 노트/승격 기록의 원자성과 기존 ES/RabbitMQ 전송의 원자성은 다르다. 외부 이벤트의 트랜잭션 후 전달 보장은 후속 과제다.

## 리뷰·QA 지침 적용과 증거 범위

갱신된 [리뷰·UX QA 프로토콜](../../../.agents/references/code-review-and-ux-qa.md)에 맞춰 기존 증거를 정리했다. 아래 연결표 → 기존 코드·동작 검증 기록 → 발견 분류·검증 범위의 세 단계로 읽는다. 이번 보완은 보고 문서에 한정하며, 이전 구현·검증을 다시 실행하거나 승인 범위를 넓히지 않았다. 기준선은 `master` 분기점 `9dcb6a4`, 웹 결과는 `codex/web-foundation`의 미커밋 변경, 백엔드 결과는 PR #6의 `94d367c`다.

### 기능과 구현 연결

파일명은 별도 표시가 없으면 웹 `src` 아래다. 기대 동작은 현재 UI의 저장·삭제·조회 동작과 이번 작업에서 합의한 정책을 기준으로 한다.

| 사용자 흐름 · 기대 동작                                            | 구현 연결                                                                                                                                | 재사용하는 검증 증거                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 새 초안의 입력·닫기·재열기: 최신 입력을 보존하고 서버 확인 뒤 완료 | `/main?draft=` → `MainPage` → `DraftEditor`/`useNoteDraft` → `draftSaveCoordinator` → `draftApi` → 백엔드 Redis/DB → Query 갱신·URL 제거 | 실제 입력·승격 후 GET 일치, 초안 hydration·재열기·삭제 후 404; 지연·실패·응답 유실은 명시한 합성 검사        |
| 로그인 복구·로그아웃: 확인된 사용자 수명 안에서만 요청·캐시 반영   | 루트/콜백 route → `authService`/`userService` → `api/client`·`authStore` → 백엔드 token/cookie → 화면·Query 상태                         | 실제 테스트 계정 복구·로그아웃과 쿠키 제거; 오래된 응답·주체 변경·콜백 실패는 합성 검사                      |
| 검색·선택 삭제: 표시된 선택을 기준으로 확인하고 실패 시 재시도     | `SearchBar` → `searchPanelStore`/조회 Hooks → `searchService` → `NoteList`/`PanelHeader` → `useNoteDelete`/`noteApi` → 목록 갱신         | 실제 최근 목록·삭제 후 GET 404; 선택 변경·삭제 실패·대상 고정·키보드는 합성 응답을 쓰는 Chrome 검사          |
| 기존 노트 조회·삭제: 합의한 조회 전용 표시와 확인된 삭제           | `/notes/$noteId` → `useNoteQuery`/`noteApi` → `NoteViewPage`·읽기 전용 `NoteEditor` → 삭제 Hook                                          | 기존 화면의 편집 미저장 기준선, 수정 후 readonly 및 실제 삭제 확인. 새 편집·저장 기능은 후속 제품 결정       |
| 그래프 조회: 정상 빈 값과 실패를 구별                              | `/main` → `Graph`/`useGraphVisualization` → `graphService` → AI API → 렌더러                                                             | 실제 빈 그래프 200, 합성 오류 후 실제 재시도, 응답 파서 검사. 비어 있지 않은 그래프의 전체 상호작용은 미검증 |

### 발견 분류와 수정 상태의 구분

아래 분류는 **발견 당시 증거**를 나타낸다. 뒤의 추적 표에서 `검증 완료`는 **수정한 경로에 명시된 회귀 검사가 통과했다**는 뜻이며, 수정 전 모든 후보가 재현됐거나 해당 기능 전체가 검증됐다는 뜻은 아니다. 같은 원인의 관련 증상은 기존 ID 안에서 추적한다.

| 주요 분류               | 기존 항목과 증거 · 영향                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 재현된 결함             | B-01·B-02·B-05의 실제 API 소유권/동시 저장/삭제 후 부활, F-02·F-03·F-05·F-06·F-12·F-13·F-18의 기준선 브라우저/API 관찰. 데이터 덮어쓰기·유실·의도하지 않은 삭제 가능성은 영향 높음, 조회/빈 결과/편집 완료 오인은 중간, 가짜 temp 요청은 낮음. B-05의 Redis 장애 분기 등 한 행의 다른 증상까지 실서버에서 재현했다고 확장하지 않는다. |
| 구현·연결 누락          | F-01: 저장 완료 흐름이 서버의 `noteId`를 받아야 하지만 실제 adapter는 `id`를 읽었다는 계약 연결 근거. 발견 당시 정적 확인이며 잘못된 완료 식별자의 영향은 중간. 수정 후 실제 승격·GET 검증은 별도 완료 증거다.                                                                                                                        |
| 코드상 위험·미검증 후보 | B-03·B-04, F-04·F-07~F-11·F-14~F-17·F-19·F-21~F-24는 구체적인 코드/계약 근거와 수정 후 확인 범위를 기록했다. 저장·세션 위험은 조건이 성립하면 영향 높음, 탐색·포커스는 중간, 미사용 API·중복 유틸은 낮음. 원본 코드의 각 실패가 재현됐다는 증거로 수정 후 통과를 사용하지 않는다. 특히 F-15의 중복 토글은 기준선에서 재현되지 않았다. |
| UX 개선 제안            | F-20의 390px 화면 겹침·문구 분절은 관찰했지만 지원 창 폭·확대 기준과 전체 작업 가능 여부는 확정하지 않았다. 레이아웃 재설계 제안으로 남기며 영향은 낮음으로 잠정 분류한다. 기존 노트 편집 기능 추가와 종료 애니메이션도 후속 결정으로, 현재 약속된 기능의 누락으로 세지 않는다.                                                       |

F-18은 **기준선에서 편집 가능하게 보이던 화면의 미저장**과 **합의 후 조회 전용으로 바꾼 현재 상태**를 구분한다. 현재 편집 기능을 새로 추가하지 않은 것은 미완료 결함이 아니다. TODO·과거 팀 기능·미사용 컴포넌트의 존재만으로 추가 기능 누락을 주장하지 않는다.

### 검증 범위 표시

- **런타임/테스트 확인:** 아래 완료 기록에 적힌 로컬 서버·GET 재조회, 실제 Chrome 동작, 합성 응답 검사, 타입·린트·빌드 결과. 서버 재시작 후 지속성이나 모든 접근성 요건까지 확인한 것으로 확대하지 않는다.
- **정적 확인만:** 나머지 열람 소스의 구조·계약·호출 관계, 실제 발급/토글을 실행하지 않은 API key·리마인더 경계. 소스 108개 열람은 모든 화면과 오류 조합의 실행 검증을 뜻하지 않는다.
- **미검증/미실행:** 실제 Google OAuth 및 다른 탭의 실제 계정 교체, 실제 한글 IME·undo/redo·붙여넣기 조합, 다중 페이지 검색·비어 있지 않은 그래프의 전체 상호작용, 모든 창 크기·확대율. 이는 이번 실행 범위의 한계이며 자동으로 결함이나 연결 누락이 되지 않는다.
- **검토 범위 밖:** 웹과 직접 연관된 초안·API 계약 이외의 백엔드 전체, 확장 프로그램·MCP 전체 검수, 모바일/WearOS 재개발, AI worker·유료 LLM 실행. 새 지침으로 범위를 확대하지 않는다.
- **차단:** 현재 기록된 완료 경로의 미해결 실행 차단 요인은 없다. 의도적으로 실행하지 않은 검사를 차단으로 바꾸어 기록하지 않는다.

## 발견 사항

각 행은 하나의 추적 ID, 우선순위, 현재 상태, 수정 경계와 확인 방법을 담는다. 발견 근거의 줄 번호는 수정 전 기준이며, 최종 구현과 실제 검증은 아래 완료 기록을 따른다. `개편 전`은 UI 재설계 전에 동작·데이터 보존을 확보할 항목이다. `개편 중`은 해당 화면을 바꿀 때 함께 처리한다.

| ID   | 시점 · 상태                       | 발견과 근거                                                                                                                                                                                                                                                        | 수정 경계 · 확인                                                                                                                                                                                     |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | 개편 전 · 검증 완료               | 타 계정이 기존 draft UUID와 version으로 저장하면 원본 사용자의 초안을 덮어쓴다. `backend/.../NoteDraftService.java:93-126`; 실서버 POST 201 확인.                                                                                                                  | 백엔드 쓰기 시 소유자 검사. 원본·타 계정 POST와 이후 GET 검사.                                                                                                                                       |
| B-02 | 개편 전 · 검증 완료               | Redis draft의 GET→version 비교→SET은 원자적이지 않다. `NoteDraftService.java:98-126`; 실서버의 동시 version 1 POST 둘 다 201/version 2를 반환했다.                                                                                                                 | 소유자·version·완료 상태를 원자적으로 검사/기록하고 동시 요청으로 검증.                                                                                                                              |
| B-03 | 개편 전 · 검증 완료               | DB 노트 생성 뒤 Redis 완료 기록 실패가 감춰져 재시도 시 중복 또는 404가 가능하다. `NoteController.java:244-290`, `NoteDraftService.java:494-511`.                                                                                                                  | 영속적인 draft→note 결과 계약과 응답 손실·Redis 실패 재시도 검증.                                                                                                                                    |
| B-04 | 개편 전 · 검증 완료               | 스케줄러가 예전 초안 스냅샷을 promotion할 수 있고 완료 상태 초안에 후속 POST도 가능하다. `NoteDraftAutoSaveService.java:64-103,146-170`, `NoteDraftService.java:93-126`.                                                                                           | 최근 버전/완료 상태와 원자적으로 조정; 스캔 중 편집·후속 POST 검사.                                                                                                                                  |
| B-05 | 개편 전 · 검증 완료               | Redis 읽기 실패가 초안 없음/빈 목록으로, 명시적 DELETE 실패가 성공 200으로 바뀐다. 삭제 후 같은 UUID/version 1의 늦은 POST가 201로 초안을 되살리는 것도 실제 API에서 확인했다. `NoteDraftService.java:253-277,368-379`.                                            | 실패와 실제 없음 구분; Redis 장애·타 계정 삭제·삭제 후 부재 검사.                                                                                                                                    |
| F-01 | 개편 전 · 검증 완료               | `draftApi.ts:100-104`는 `data.id`를 읽지만 서버 `NoteResponse.java:13`은 `noteId`를 반환한다. 완료 콜백에 `undefined`가 전달될 수 있다.                                                                                                                            | 응답의 양의 정수 `noteId` 검증 후만 완료 처리. POST 201→GET→draft 정리 확인.                                                                                                                         |
| F-02 | 개편 전 · 검증 완료               | debounce된 draft POST를 기다리지 않고 promotion한다. 실서버에서 제목만 바꾸고 즉시 닫자 **이전 제목으로 영구 저장**됐다. `useNoteDraft.ts:95-169,188-200,245-269`, `DraftEditor.tsx:68-96`.                                                                        | 최신 편집값·저장 응답·version을 연결하고 POST 확정 뒤 promotion. 500ms 이내 닫기, 늦은 응답·409·저장 실패·재열기로 검증.                                                                             |
| F-03 | 개편 전 · 검증 완료               | draft GET 후 입력 초기화와 Milkdown `defaultValue`가 현재 편집/대상을 보호하지 못한다. 실서버에서 제목은 보이고 본문은 빈 화면을 관찰했다. `useNoteDraft.ts:60-78`, `NoteEditor.tsx:22-49`, `DraftEditor.tsx:137`.                                                 | draft ID별 초기화/에디터 수명과 늦은 GET을 정리. GET 전 입력, 재열기, 대상 전환 확인.                                                                                                                |
| F-04 | 개편 전 · 검증 완료               | 의도적 삭제는 비동기 완료 전 화면을 닫고, 대기 중 POST가 삭제한 draft를 되살릴 수 있다. 실패 후 닫기는 보존을 주장하지만 최신 입력이 서버에 없을 수 있다. `DraftEditor.tsx:68-102`, `useNoteDraft.ts:271-280`.                                                     | 예약/진행 중 저장을 조정하고 삭제 결과 확인 뒤 닫기; 실패 시 편집 복구 상태 유지.                                                                                                                    |
| F-05 | 개편 전 · 검증 완료               | 종료 beacon은 Vite 상대 경로를 쓰고 Bearer 헤더가 없으며, promotion 서버는 beacon 본문을 읽지 않는다. `useNoteDraft.ts:202-231`, `useBeforeUnloadSave.ts:24-59`.                                                                                                   | 정상 인증 요청이 저장의 기준. 종료 요청은 계약 가능한 최선 노력으로만 취급; 이탈·재열기 검증.                                                                                                        |
| F-06 | 개편 전 · 검증 완료               | 최근 목록이 비면 서버는 의도적으로 `data`를 생략한다(`NoteServiceImpl.java:297-307`, `BaseResponse.java:15`). `searchService.ts:32-35`→`useRecentNotes.ts:12-15`는 `undefined`를 반환해 Query 오류가 났다. 오류 UI는 빈 목록으로 보인다(`NoteList.tsx:27-40`).     | **이 엔드포인트에서만** 성공·누락/`null` data를 `[]`로 정규화하고 그 외 불량 응답은 오류로 표시. 생성 후 목록 갱신 포함.                                                                             |
| F-07 | 개편 전 · 검증 완료               | 루트 복구가 모든 오류를 `null`로 캐시해 재시도와 실패 표시를 막으며 토큰만 저장된 상태도 만든다. `routes/__root.tsx:23-65`; 미사용 `useSessionRestore.ts`에 중복 구현.                                                                                             | refresh 401만 익명으로 처리. 5xx/타임아웃·`/me` 실패·재시도 검사, 복구 소유자 하나로 통합.                                                                                                           |
| F-08 | 개편 전 · 검증 완료               | 오래된 401/refresh·재전송이 새 계정 토큰과 캐시를 건드리거나 이전 쓰기를 새 토큰으로 보낼 수 있다. refresh의 네트워크/서버/형식 오류도 로그아웃으로 처리한다. `api/client.ts:85-133`.                                                                              | 기존 store에 세션 epoch 추가, 원 요청 수명·refresh·재전송·모든 콜백 확인. A→B 및 동일 계정 재로그인 중 늦은 성공/실패 검증.                                                                          |
| F-09 | 개편 전 · 검증 완료               | OAuth 교환은 `/me` 전에 인증 플래그를 세우고, 사용자 조회 실패 시 부분 인증을 남긴다. `success:false` 200에는 콜백 spinner가 남는다. `useExchangeToken.ts:20-48`, `authStore.ts:28-32`.                                                                            | 검증된 토큰·사용자를 일관되게 확정하고 실패를 화면에 남김. 실패·잘못된 응답·재로그인 확인.                                                                                                           |
| F-10 | 개편 전 · 검증 완료               | Axios 제네릭과 `isBaseResponse`는 실제 필드 검증이 아니다. draft/note/API key/reminder/search/graph의 불량 2xx가 저장·삭제·토글 성공으로 해석될 수 있다. `api/client.ts:20-22,73-84`, 각 service.                                                                  | 공통 envelope + 엔드포인트별 Zod 경계, 성공과 유효한 빈 응답 구분. 잘못된 중첩 필드·`success:false` 검사.                                                                                            |
| F-11 | 개편 전 · 검증 완료               | 계정 전환에서 같은 Query 키가 사용자 데이터를 공유하며, 이전 logout·reminder/API-key 콜백이 새 세션에 반영될 수 있다. `useCurrentUser.ts:17`, `useLogout.ts:23-41`, `useReminderToggle.ts:25-60`.                                                                  | 기존 키 접두사를 유지하며 비밀이 아닌 epoch로 private 캐시 분리. 쿼리 취소와 콜백 가드, draft 복구 데이터 보존 검사.                                                                                 |
| F-12 | 개편 전 · 검증 완료               | 메인 `/main`은 draft가 없어도 가짜 `temp` 초안을 요청한다. `MainPage.tsx:76-84`, `useNoteDraft.ts:60-67`.                                                                                                                                                          | 실제 ID가 있을 때만 로드하고 확정된 닫기 뒤 같은 UUID만 URL에서 replace로 제거. 일반 메인 진입 네트워크 검사.                                                                                        |
| F-13 | 개편 전 · 검증 완료               | 검색/최근 전환 뒤 보이지 않는 이전 선택 ID가 남아 실제 삭제 대상이 된다. `searchPanelStore.ts:57-89`, `SearchPanel.tsx:26-37`, `PanelHeader.tsx:69-86`; 실서버에서 A 선택→불일치 검색 후 삭제 버튼 활성 확인.                                                      | 표시 목록과 선택 수명을 맞추고 확인 시 대상을 고정. 검색·모드 변경 후 삭제 검증.                                                                                                                     |
| F-14 | 개편 전 · 검증 완료               | 닫힌 패널·메뉴의 보이지 않는 버튼이 Tab으로 접근된다. 전역 메뉴 키 핸들러는 다른 입력의 Tab/방향키도 가로챈다. `MainPage.tsx:87-95`, `Dropdown.tsx:43-53`, `useKeyboardNav.ts:84-145`.                                                                             | 숨김 상태의 포커스 차단, 메뉴 범위 키 처리와 닫기 후 포커스 복귀. Chrome 키보드 검증.                                                                                                                |
| F-15 | 개편 전 · 검증 완료               | 행과 내부 체크 버튼에 키보드 활성화 주체가 겹친다. `NoteItem.tsx:39-69`. 외부 Chrome의 Space/Enter는 각각 한 번 전환되어 중복 토글은 재현되지 않았다.                                                                                                              | 한 컨트롤만 Enter/Space 처리하도록 의미 구조 정리; 키·클릭별 한 번 토글 확인.                                                                                                                        |
| F-16 | 개편 전 · 검증 완료               | 검색 입력의 로컬 텍스트와 패널 store query가 닫기/재열기에 달라지고, `isSelectAllMode`가 일부 해제 후에도 남는다. `SearchBar.tsx:16-36`, `searchPanelStore.ts:92-109`, `PanelHeader.tsx:42-53`.                                                                    | 입력/적용 쿼리와 전체선택 범위(로드된 항목)를 명시하고 화면 검증.                                                                                                                                    |
| F-17 | 개편 중 · 일부 정비 / 잔여 유지   | `/main?noteId=`는 검증되지만 화면에서 쓰지 않으며 닫기 후 Back이 draft를 다시 열 수 있다. `routes/main.tsx:10-13`, `MainPage.tsx:27-45`. 노트 path는 숫자 검증 없이 `Number()`로 변환한다.                                                                         | 양의 safe integer만 조회/삭제하고 닫기 replace를 적용했다. 늦은 A 초안 조회 뒤 B 유지, 닫기 뒤 Back/Forward에서 초안이 다시 열리지 않음 확인. 미사용 noteId query와 전반적 URL 설계는 개편에서 정리. |
| F-18 | 개편 중 · 일부 정비 / 잔여 유지   | 검색/그래프 오류에는 실제 재시도 경로가 없고, 편집 가능한 기존 노트의 제목·본문은 서버에 저장되지 않는다. `NoteList.tsx:60-73`, `Graph.tsx:109-126`, `NoteViewPage.tsx:119-130`.                                                                                   | 오류 UI 재요청 확인. 상세 화면에서 수정 후 닫기/재열기 시 원문으로 돌아감을 Chrome에서 확인. 조회 전용 표시를 선행 정비하고 수정·저장 기능은 UI 개편 때 결정.                                        |
| F-19 | 개편 중 · 대기                    | 슬라이드오버의 포커스·이름·복귀가 불완전하고 그래프 노드는 마우스 경로만 보인다. `SlideOverModal.tsx:20-69`, `useModal.ts:51-79`, `Graph.tsx:101-146`.                                                                                                             | 화면 의미에 맞는 모달/메뉴 키 계약과 접근 가능한 노트 경로 확인.                                                                                                                                     |
| F-20 | 개편 중 · 대기                    | 27% 패널, 고정 폭 검색, 전체 화면 overflow·spinner 크기가 좁은 화면/확대에서 깨질 수 있다. `MainPage.tsx:87-95`, `SearchBar.tsx:47`, `BaseLayout.tsx:7-10`, `LoadingSpinner.tsx:16`.                                                                               | 실제 너비·확대·스크롤로 UI 개편 시 검증.                                                                                                                                                             |
| F-21 | 개편 전 · 검증 완료               | Graph API의 Pydantic ID는 정수, `stats`는 nullable인데 프런트 타입은 문자열/필수다. `knowledge-graph-service/app/schemas/graph.py:7-37,62-77`, `types/graph.ts:2-41`. `fastApiClient`의 `'demo-user'`는 서버가 요구하는 정수 ID도 아니다(`api/client.ts:158-167`). | 그래프 adapter에서 직접 응답 검증, 타입/헤더 정렬; AI 서버 연결 시 확인.                                                                                                                             |
| F-22 | 개편 전 · 계약 정비 완료          | `noteApi.ts`의 POST 반환형·단건 DELETE URL·부분 PUT이 백엔드 계약과 다르다. `NoteController.java:50-117`, `NoteRequest.java:20-27`; `noteApi.ts:40-89`. 일부 함수는 현재 미사용이다.                                                                               | 사용 전 실제 계약으로 정리, 응답/요청 검증.                                                                                                                                                          |
| F-23 | 개편 전 · 세션 정비 / 일부 미검증 | 사용자 프로필, API key, reminder UI의 늦은 응답·포커스·에러 로깅이 정리되지 않았다. `ApiKeyManagement.tsx:27-30`, `UserAvatar.tsx:17-39`, `ReminderToggleMenuItem.tsx:22-47`, `useExchangeToken.ts:33-39`.                                                         | 세션 소유 콜백, API key 형식, 민감 정보 없는 진단과 키보드 확인.                                                                                                                                     |
| F-24 | 추후 · 대기                       | `cookie.ts`는 HttpOnly refresh cookie를 볼 수 없고, `cn` 유틸은 두 파일에 중복이다. 컴포넌트 정적 데이터/선언과 공통 wrapper props에도 관례 차이가 있다.                                                                                                           | 관련 파일 변경 시 정리. **화살표 함수라는 이유만으로 `React.FC` 위반이라고 보지 않는다.** `forwardRef`도 React 19에서 지원된다.                                                                      |

## 프런트엔드 구현 순서와 응답 경계

1. 백엔드 PR의 소유권·원자적 version·promotion 최종성·명시적 삭제 계약을 검토한다. 실서버 저장 완료를 선언하기 전에 타 계정 덮어쓰기, 같은 version 경쟁, 응답 손실 후 재시도, Redis 장애, 스케줄러와 편집 경쟁을 독립 검증한다.
2. 프런트엔드에서는 Zod 4를 사용해 `unknown` HTTP 본문을 **서비스 경계에서** 검증한다. 공통 Spring envelope는 `success:boolean`, `code:number`, `message:string`을 확인한다. `data`는 엔드포인트별로 필수/생략 가능 여부를 정한다. `/users/me`와 FastAPI 그래프는 직접 응답이다. 공통 Axios client는 전송·인증 수명만 다루고 feature service를 import하지 않아 순환 참조를 피한다. 먼저 최근 빈 목록과 draft `noteId`를 바로잡고, 그 다음 note/search/graph/API key/reminder 응답을 맞춘다.
3. `authStore.ts`의 인메모리 토큰 경계를 유지하며 새 로그인·로그아웃 수명에 epoch를 붙인다. 401은 동일 epoch의 토큰 있는 보호 요청에서만 갱신·1회 재시도한다. refresh 자체와 token 교환은 재귀 갱신하지 않는다. logout에는 Bearer 토큰을 전송하고 보호 요청과 동일한 1회 갱신 계약을 적용한다. 403은 권한 오류 그대로 전달한다. 401 refresh만 해당 세션을 종료하고, 5xx/timeout/형식 오류/재전송 실패는 작업 오류로 보여준다. 이전 수명의 요청은 새 계정 자격으로 재전송하지 않고, 완료 콜백도 새 세션 state/cache/navigation을 바꾸지 않는다. 브라우저가 이미 받은 `Set-Cookie`는 클라이언트 epoch 검사로 되돌릴 수 없으므로 인증 요청의 서버 측 순서·쿠키 동작도 통합 검증한다.
4. 기존 Query 키 접두사를 유지하면서 사용자별 private 조회에 비밀이 아닌 epoch를 추가하거나 동일한 보장을 하는 취소·퇴출 경계를 둔다. `useCurrentUser`, 최근/검색, 그래프, 노트/초안 조회와 그 mutation 콜백을 함께 조정한다. 가능하면 Query의 `signal`을 Axios 읽기 요청으로 전달한다. 취소는 이미 수락된 쓰기를 되돌리지 않으므로 draft·delete·reminder의 늦은 완료는 별도 epoch/작업 ID를 확인한다. 기존 localStorage draft는 정책 결정 없이 삭제하지 않는다.
5. 노트 흐름에서 편집 상태→최신 Redis 저장 확인→DB promotion→응답의 양의 정수 noteId 확인→최근 목록/노트/그래프 갱신→닫기 순서를 한 작업으로 만든다. 404인 새 draft와 네트워크/권한 오류를 구별한다. 의도적 삭제는 진행 중 저장을 정리하고 삭제 결과를 확인한 뒤 닫는다. 저장 실패 시 서버에 남지 않은 입력을 “임시 저장됨”이라 단정하지 않는다.
6. 화면 재설계는 선택·키보드·포커스·URL 계약이 확정된 뒤 진행한다. `React.FC` 사용 여부와 단순 화살표 함수 선언은 별개의 문제다. 성능 최적화는 관찰된 병목과 전후 수치가 있을 때만 한다.

현재 서버 응답의 핵심 예외는 다음과 같다.

| 서비스 · 소유 파일                                                   | 실제 성공 응답과 처리 기준                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인증 `authService.ts`, 사용자 `userService.ts`                       | token/refresh는 `BaseResponse<{accessToken,tokenType:Bearer,expiresIn}>`; logout은 `data` 생략. `/users/me`는 `{id,email,name,picture,setAlarm}` 직접 반환이며 picture는 문자열 또는 null이다. Refresh cookie는 HttpOnly다.                                                                                                                                   |
| API key `features/auth/api/apiKey.ts`, reminder `reminderService.ts` | 발급은 `BaseResponse<{apiKey}>`(UUID), 삭제·토글은 `data` 없는 성공 envelope. HTTP 2xx의 `success:false`는 성공이 아니다.                                                                                                                                                                                                                                     |
| 초안 `api/client/draftApi.ts`                                        | save/get은 `{noteId,title,content,version,lastModified}`, 목록은 `{drafts:[],totalCount:0}`도 유효하다. promotion은 `NoteResponse.noteId`; DELETE는 `data` 생략. 요청 `version`은 필수다.                                                                                                                                                                     |
| 노트 `api/client/noteApi.ts`                                         | GET/PUT은 `noteId,title,content,createdAt,updatedAt,remindAt,remindCount`; POST create·DELETE는 `data` 없는 성공. PUT은 제목·본문 모두 필수, DELETE는 `/api/notes`와 `{noteIds}`다.                                                                                                                                                                           |
| 검색 `features/main/services/searchService.ts`                       | recent는 성공 시 `data:[{noteId,title}]`, **빈 결과는 현재 data 자체가 생략**된다. search는 `{results:[{id,title,content,userId,createdAt,updatedAt,remindCount}],totalCount,currentPage,totalPages,pageSize}`; similar는 결과 배열이다. 비어 있는 유효 결과와 잘못된 본문을 구별한다.                                                                        |
| 그래프 `features/main/services/graphService.ts`                      | FastAPI 직접 객체: visualization의 `user_id`, node/link ID는 정수이고 `stats`는 객체 또는 `null`; neighbors의 `center_note_id`·이웃 ID도 정수, `depth` 1~3; stats는 직접 `{user_id,total_notes,total_relationships,avg_connections}`. AI 서비스 `/ai/health`와 실제 그래프 요청을 확인했다. 그래프는 합성 사용자에 대해 HTTP 200과 빈 nodes/links를 확인했다. |

URL·저장소 경계도 소유자별로 검증한다. `routes/auth/callback.tsx`의 OAuth `code/error`, `routes/main.tsx`의 UUID draft·양의 정수 noteId, `routes/notes/$noteId.tsx`의 path ID, `config/env.ts`의 공개 Vite URL, 초안 복구 저장소가 해당한다. 기존 unscoped `draft:${draftId}` 값은 읽어 새 계정에 이식하지 않고, 새 복구본은 사용자 ID와 draft ID로 구분한다. 인증 없는 종료 beacon은 제거했다. 이전 unscoped draft 데이터의 삭제/이전은 별도 제품 결정 없이는 하지 않는다. `shared/utils/cookie.ts`로 HttpOnly cookie 존재를 판단하지 않는다.

## 확인 계획

- 백엔드 선행: B-01~B-05의 소유권, 동시성, 장애, promotion 재시도, 스케줄러 경쟁 테스트와 독립 DB/Redis 조회. 별도 PR의 검토 상태를 문서에 반영한다.
- 프런트엔드 경계: 각 서비스에 정상, 유효한 빈 값, `success:false`, 누락/틀린 필드, HTTP 401/403/5xx를 검사한다. recent의 누락 data→`[]`는 해당 API에만 적용한다. 합성 응답과 실서버 저장 확인을 구분한다.
- 인증: A→B, 동일 계정 재로그인, 오래된 refresh 성공/실패, 재전송 실패, 로그아웃 중 새 로그인, `/me` 실패를 확인한다. 토큰·개인 note 내용은 로그/문서에 쓰지 않는다.
- 실제 브라우저: draft 즉시 닫기/재열기·삭제 실패·검색 선택 삭제 대상·체크박스 Enter/Space·숨긴 패널 Tab·드롭다운 Escape/Tab·라우트 Back/Forward·좁은 화면을 흐름별로 확인한다. AI 그래프의 실제 응답과 Google OAuth는 별도 검증이 필요하다. 워커·유료 LLM 호출은 실행하지 않았다.
- 변경 후 정적 검사: 해당 웹 모듈의 `pnpm typecheck`, `pnpm lint`, `pnpm build`; 최종 검사 결과는 아래에 기록한다. `package.json`에는 test 명령이 없으며, 이번 회귀 검사는 `checks/`의 독립 Playwright CLI 스크립트로 보관했다.

## 구현과 검증 완료 기록

### 노트 저장과 데이터 보존

`DraftSaveCoordinator`가 편집 스냅샷, Redis 저장 응답의 버전, 승격, 삭제를 하나의 순서로 조정한다. Milkdown 7.22.2의 공개 ProseMirror 플러그인/serializer로 편집 시점의 Markdown을 받아, 지연 리스너보다 빠른 닫기에도 최신 값을 사용한다. 초안 조회 성공 또는 명시적인 404 전에는 입력기를 열지 않는다. 읽기 오류 화면에는 재시도와 닫기를 제공한다.

- 실제 Chrome 입력 → 즉시 닫기 → POST 승격 201 → 별도 GET: 새 노트의 최신 제목·본문 일치.
- 기존 Redis 초안의 초기 본문 표시, 제목만 수정 후 즉시 닫기 → GET: 새 제목과 기존 본문 일치.
- 제목만 있는 초안은 Redis에 남기고 닫으며, 재열기에서 값 유지. 완전히 지운 기존 초안을 닫으면 삭제됨을 GET 404로 확인.
- DELETE 500을 합성한 경우 편집 화면 유지. 합성을 해제한 실제 DELETE 200 뒤 독립 HTTP GET 404 확인.
- 저장 500을 합성한 경우 닫히지 않고 사용자별 localStorage 복구본 유지. 완전한 페이지 이동 후 같은 초안 재열기에서 제목·본문 복원 확인.
- 기존 영구 노트 제목은 readonly, Milkdown 본문은 `contenteditable=false` 확인. 기존 노트 수정·저장 기능 추가는 UI 개편에서 결정한다.
- 합성 coordinator 12개 검사: 생성자 부작용 없음, 저장 응답 유실 후 GET 재조정, 진행 중 저장을 기다리는 삭제, 승격 응답 유실 후 같은 ID 재시도, 불확정 승격 삭제 차단, 충돌 시 복구본 유지 등 통과.

실제 UI로 이번 검증에서 만든 QA 노트 3개를 삭제한 뒤 각각 독립 GET 404를 확인했고, data가 생략된 빈 recent 응답도 화면에서 정상 표시됐다.

사용자·세션·초안 ID가 편집기 수명을 구분한다. 초안 close 콜백은 현재 URL이 같은 draft ID일 때만 제거한다. 저장을 서버에서 확정하지 못했을 때는 복구본 존재 여부까지 구분해 안내한다. 로컬 저장소도 실패하면 입력 내용을 복사하도록 안내하며 저장 성공으로 표시하지 않는다. 사용하지 않는 이전 `useBeforeUnloadSave`, `useDebouncedSave`, `noteService`는 제거했다.

### 인증과 응답 경계

Zod 4가 Spring envelope와 엔드포인트별 payload를 검사한다. 최근 노트 API의 성공 응답에서만 생략/null data를 빈 배열로 정규화한다. 검색·그래프 ID는 실제 숫자 계약을 따르고 nullable stats를 허용한다. D3가 Query 캐시의 graph 객체를 직접 변경하지 않도록 렌더러에 별도 node/link 객체를 전달한다.

세션 epoch는 요청 예약 시 고정하며, 오래된 요청·콜백이 새 계정으로 실행되거나 캐시를 바꾸지 못하게 한다. 401 갱신은 같은 세션에서 합치고, 후보 토큰의 `/users/me` ID가 현재 사용자와 같은지 확인한 뒤 재전송한다. 다른 탭에서 쿠키 계정이 바뀐 경우 이전 화면의 요청을 새 계정으로 재생하지 않는다. 로그아웃은 서버 확인 뒤 완료하며 실패 때는 재시도할 수 있다. 리마인더는 상대 토글을 직렬화하고 `/users/me` 재조회 값으로 store/cache를 맞춘다.

- 응답 파서 18개 합성 검사 통과: 정상/빈 값, 잘못된 필드·ID·날짜·그래프 점수, `success:false` 구분.
- 인증 기본 합성 25개, refresh 주체 불일치 4개, terminal 401 3개 검사 통과. 403/refresh500/replay500, 예약·응답 시점의 epoch 변경, logout 헤더와 실패·성공 envelope를 포함한다.
- 복구·콜백 합성 UI 5개 통과: refresh500 오류 표시 및 재시도 복구, refresh401 랜딩, token success:false와 후속 /me500에서 부분 인증 없이 오류 표시. 실제 로그아웃은 HTTP 200, refresh cookie 제거, 새로고침 뒤 로그아웃 유지 확인.
- Vite HMR 뒤 테스트가 bare 경로의 store를 별도로 import해 발생한 초기 실패는, 서비스가 실제 import하는 URL을 사용하도록 검증 도구를 수정해 해결했다. 앱 결함 또는 통과로 오기록하지 않았다.

### 메인·검색·키보드

합성 recent/search/DELETE 응답을 사용한 외부 Chrome UI 24개 검사가 통과했다. 검색 입력 즉시 선택·삭제 모드 초기화, 확인창의 ID/수량 고정, DELETE 500에서 확인창 유지, 같은 ID로 재시도, 성공 뒤 recent/search 캐시 갱신을 확인했다. 확인창이 열린 중간의 선택 변경은 앱의 실제 store에 합성 상태를 주입한 검사다. 나머지 선택·삭제·포커스 경로는 브라우저 입력으로 실행했다.

사용자 조회와 그래프의 합성 500을 해제한 뒤 다시 시도로 실제 서버 응답을 복구했고, 검색 500과 정상 빈 결과를 구분해 표시하며 재시도가 동작함을 확인했다.

닫힌 패널/메뉴의 inert, 패널 열기·닫기 포커스 이동, 체크박스 Space 한 번 전환, 메뉴 바깥 입력의 방향키 보존, Escape·Shift+Tab 닫기, API Key 관리 화면의 뒤로 버튼 포커스와 Tab 이탈을 확인했다. 검증 도구의 숨김 요소 locator·비동기 닫기 대기 오류는 수정 후 다시 실행했으며 앱 결함으로 집계하지 않았다.

지연된 A 초안 GET 중 닫고 B 초안을 열어 입력한 뒤 A 응답을 전달해도 B 내용이 유지됐다. 새 초안 닫기 뒤 Back/Forward가 완료된 초안을 다시 열지 않는 것도 확인했다. 닫힘 처리가 확정된 편집기는 즉시 unmount하며, 종료 애니메이션은 UI 개편 경계로 남긴다.

### 정적 검사와 남은 범위

Node 26.10.0 / pnpm 12.6.0에서 `pnpm typecheck`, `pnpm lint`, `pnpm build`를 실행해 모두 통과했다. 린트는 오류 0개, 기존 공유 UI의 forwardRef 및 useResponsiveWidth 관련 경고 11개다(기준선 18개). Graph/Milkdown 큰 청크 경고는 남아 있으며, 이번 변경을 성능 개선으로 주장하지 않는다.

Google OAuth 실제 제공자 로그인, 유료 LLM/AI worker, 실제 다중 계정 Google 로그인은 실행하지 않았다. 합성 응답 검증과 실제 서버 지속성 검증은 위에서 구분했다. 루트의 refresh 요청이 처리되는 도중 페이지 전체를 다시 이동해 응답을 끊으면, 서버의 토큰 회전 결과를 브라우저가 받지 못해 재로그인이 필요할 수 있다. 이 서버 쿠키 회전·응답 유실 정책은 후속 범위다. 초안 복구본은 사용자 ID별로 유지한다.

390×844 Chrome 확인에서 27% 검색 패널이 약 105px로 줄어 문구가 여러 줄로 분절되고 검색 입력·프로필 영역이 겹쳤다. 1280×963으로 복귀했다. 반응형 재설계는 이번 기반 정비에 포함하지 않았다.

UI 개편에 남긴 항목: 좁은 화면의 27% 검색 패널과 고정 폭·padding, 슬라이드오버의 접근성/포커스 계약, 그래프 키보드 탐색, 미사용 query parameter 정리, 기존 노트의 편집·저장 정책, 공통 wrapper/상수/유틸의 관련 없는 정리와 미사용 `useSessionRestore` Hook의 중복 제거. 전체 소스를 검토했다는 것은 이 항목까지 모두 수정했다는 뜻이 아니다.

AGENTS.md에는 일반 UI 확인 시 기본 외부 Chrome 재사용, 인증·계정·합성 응답 격리 때만 임시 세션 생성, 안전한 검증 경계에서 자신이 만든 임시 세션만 정리하는 원칙을 한 항목으로 추가했다. 사용자 창과 탭은 닫지 않는다. 인증용 임시 Chrome 세션은 검증 후 종료했고, 기존 기본 작업 세션은 유지했다.

## 수기 소스 파일 목록

다음은 변경 전 검토 목록이다. 이후 추가된 세션 schema/응답 경계/저장 coordinator 파일도 통합 검토했고, 제거한 미사용 파일은 기준선 추적을 위해 목록에 남겼다. 상대 경로는 모두 `frontend/secondbrain/src/` 아래다. 인증/API 39개, 메인·공유·라우트 52개, 노트 16개, 통합 1개로 중복 없이 108개다.

### 인증·API·설정·상태·리마인더·공통 계약 (39)

- `api/client/draftApi.ts`
- `api/client/noteApi.ts`
- `api/client.ts`
- `config/env.ts`
- `features/auth/api/apiKey.ts`
- `features/auth/components/ApiKeyManagement.tsx`
- `features/auth/components/ApiKeyMenuItem.tsx`
- `features/auth/components/GoogleLoginButton.tsx`
- `features/auth/components/LogoutButton.tsx`
- `features/auth/components/UserAvatar.tsx`
- `features/auth/components/UserProfile.tsx`
- `features/auth/components/UserProfileButton.tsx`
- `features/auth/components/UserProfileMenu.tsx`
- `features/auth/hooks/useApiKeyVisibility.ts`
- `features/auth/hooks/useCallbackHandler.ts`
- `features/auth/hooks/useCurrentUser.ts`
- `features/auth/hooks/useDeleteApiKey.ts`
- `features/auth/hooks/useExchangeToken.ts`
- `features/auth/hooks/useGenerateApiKey.ts`
- `features/auth/hooks/useLogout.ts`
- `features/auth/hooks/useSessionRestore.ts`
- `features/auth/pages/CallbackPage.tsx`
- `features/auth/pages/LandingPage.tsx`
- `features/auth/services/authService.ts`
- `features/auth/services/userService.ts`
- `features/auth/types/apiKey.ts`
- `features/auth/types/auth.ts`
- `features/reminder/components/ReminderToggleMenuItem.tsx`
- `features/reminder/hooks/useReminderToggle.ts`
- `features/reminder/services/reminderService.ts`
- `lib/cn.ts`
- `lib/queryClient.ts`
- `lib/utils.ts`
- `shared/types/api.ts`
- `shared/types/draft.types.ts`
- `shared/types/note.types.ts`
- `shared/utils/cookie.ts`
- `shared/utils/typeGuards.ts`
- `stores/authStore.ts`

### 메인·공유 UI·라우트·레이아웃 (52)

- `App.tsx`
- `features/main/components/Graph.tsx`
- `features/main/components/NoteItem.tsx`
- `features/main/components/NoteList.tsx`
- `features/main/components/PanelHeader.tsx`
- `features/main/components/SearchBar.tsx`
- `features/main/components/SearchPanel.tsx`
- `features/main/hooks/useDebounce.ts`
- `features/main/hooks/useGraphVisualization.ts`
- `features/main/hooks/useRecentNotes.ts`
- `features/main/hooks/useSearchNotes.ts`
- `features/main/pages/MainPage.tsx`
- `features/main/services/graphService.ts`
- `features/main/services/searchService.ts`
- `features/main/stores/graphStore.ts`
- `features/main/stores/searchPanelStore.ts`
- `features/main/types/graph.ts`
- `features/main/types/search.ts`
- `index.css`
- `layouts/BaseLayout.tsx`
- `layouts/LandingLayout.tsx`
- `layouts/MainLayout.tsx`
- `layouts/NoteLayout.tsx`
- `layouts/RootLayout.tsx`
- `main.tsx`
- `routes/__root.tsx`
- `routes/auth/callback.tsx`
- `routes/index.tsx`
- `routes/main.tsx`
- `routes/notes/$noteId.tsx`
- `shared/components/Dropdown/Dropdown.tsx`
- `shared/components/Dropdown/Dropdown.types.ts`
- `shared/components/ErrorBoundary/ErrorBoundary.tsx`
- `shared/components/GlassContainer/GlassContainer.tsx`
- `shared/components/GlassElement/GlassElement.tsx`
- `shared/components/GlassElement/glassElement.styles.ts`
- `shared/components/GlassElement/glassElement.utils.ts`
- `shared/components/GlassElement/useGlassEffect.ts`
- `shared/components/LoadingSpinner.tsx`
- `shared/components/SlideOverModal/SlideOverModal.tsx`
- `shared/components/SlideOverModal/SlideOverModal.types.ts`
- `shared/components/ToggleSwitch/ToggleSwitch.tsx`
- `shared/components/ui/alert-dialog.tsx`
- `shared/components/ui/button.tsx`
- `shared/components/ui/input.tsx`
- `shared/components/ui/tooltip.tsx`
- `shared/hooks/useInfiniteScroll.ts`
- `shared/hooks/useKeyboardNav.ts`
- `shared/hooks/useModal.ts`
- `shared/hooks/useResponsiveWidth.ts`
- `shared/styles/custom-scrollbar.css`
- `shared/styles/glass-base.css`

### 노트 (16)

- `features/note/components/DraftEditor.tsx`
- `features/note/components/DraftToolbar.tsx`
- `features/note/components/NoteCreateModal.tsx`
- `features/note/components/NoteEditor.css`
- `features/note/components/NoteEditor.tsx`
- `features/note/components/NoteTitleInput.tsx`
- `features/note/components/SidePeekOverlay.tsx`
- `features/note/hooks/useBeforeUnloadSave.ts`
- `features/note/hooks/useDebouncedSave.ts`
- `features/note/hooks/useNoteDelete.ts`
- `features/note/hooks/useNoteDraft.ts`
- `features/note/hooks/useNoteQuery.ts`
- `features/note/pages/NotePage.tsx`
- `features/note/pages/NoteViewPage.tsx`
- `features/note/services/noteService.ts`
- `features/note/types/note.ts`

### 통합 (1)

- `vite-env.d.ts`
