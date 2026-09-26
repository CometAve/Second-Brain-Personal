# 기반 동작 회귀 확인

새 테스트 프레임워크 없이 공식 `playwright-cli`의 `run-code`로 실행하는 브라우저 검사다. 웹 Vite 서버가 `http://localhost:5173`에서 실행 중이어야 한다. 저장소 루트에서 아래 명령을 실행한다. 결과의 `passed`와 개별 항목을 확인한다.

일반 UI 검증은 기존 작업용 외부 Chrome 세션을 재사용한다. `verify-foundation-api.js`는 실제 서비스 파서에 합성 값을 전달하고, `verify-draft-coordinator.js`는 무작위 합성 UUID에 해당하는 요청만 가로챈다. `verify-main-ui.js`는 recent/search/삭제 응답과 확인창 중 선택 변경을 합성하며 종료 시 가로채기를 해제하고 새로고침한다. 실제 서버 저장 완료의 증거는 아니다. 인증된 테스트 계정으로 열린 기본 작업 세션에서 실행한다.

```sh
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-foundation-api.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-draft-coordinator.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-note-edit-coordinator.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-main-ui.js
```

`verify-note-edit-coordinator.js`는 무작위 합성 노트 ID에 대한 저장 직렬화·삭제 대기·응답 유실 재조정·계정별 복구·공백 보존을 확인한다. API 검사에는 저장 노드 전체와 AI 링크 결합 계약도 포함한다. 초안 coordinator 검사는 복구 저장소가 실패한 경우의 이탈 보호를 포함하며, 브라우저 저장소 메서드는 검사 종료 시 복원한다. 이 검사들은 실제 서버 지속성의 증거와 구분한다.

인증 검사는 토큰·사용자·HTTP 응답을 합성하므로 기존 검증 세션과 격리한다. 기존의 격리 세션이 있다면 재사용하며, 필요할 때만 아래와 같이 외부 Chrome 세션을 연다. 사용자 프로필이나 실제 인증 쿠키를 주입하지 않는다.

```sh
playwright-cli -s=sb-auth-regression open about:blank --browser=chrome --headed
playwright-cli -s=sb-auth-regression run-code --filename=frontend/secondbrain/checks/verify-auth-foundation.js
playwright-cli -s=sb-auth-regression run-code 'async page => { await page.unrouteAll({ behavior: "wait" }); }'
playwright-cli -s=sb-auth-regression run-code --filename=frontend/secondbrain/checks/verify-auth-subject.js
playwright-cli -s=sb-auth-regression run-code 'async page => { await page.unrouteAll({ behavior: "wait" }); }'
playwright-cli -s=sb-auth-regression run-code --filename=frontend/secondbrain/checks/verify-auth-terminal.js
playwright-cli -s=sb-auth-regression run-code 'async page => { await page.unrouteAll({ behavior: "wait" }); }'
playwright-cli -s=sb-auth-regression run-code --filename=frontend/secondbrain/checks/verify-auth-routes.js
playwright-cli -s=sb-auth-regression close
```

검사가 끝난 뒤 자신이 만든 임시 세션만 닫는다. 정리를 위해 실행 중인 검사를 중단하거나 사용자 창·탭을 닫지 않는다. 기본 검증 세션은 계속 재사용한다.

Vite HMR에서 같은 파일의 bare URL과 timestamp URL은 서로 다른 모듈이 될 수 있다. 인증 검사는 서비스가 실제로 import하는 client/store URL을 사용한다. 형식·정책 검사와 실제 백엔드 지속성 검증, 실제 Google OAuth는 구분한다. 이번 실행 결과와 남은 범위는 [검수 기록](../docs/foundation-review.md)에 적었다.

## UI/UX 개편 회귀 검사

개편 후 확인용 스크립트도 공식 `playwright-cli run-code --filename` 형식으로 실행한다. 기존 인증된 QA 세션과 개발 서버를 사용하며, 사용자 데이터가 들어 있는 세션에서는 실행하지 않는다. 실제 실행 결과와 화면·성능 증거는 [UI/UX 개선 기록](../docs/ui-ux-refresh.md)을 본다. 병렬로 같은 세션을 조작하지 않는다.

자동 생성하는 화면·영상은 Git이 무시하는 `.playwright-cli/` 아래에 저장한다. 일반 UI 자료는 `ui-ux-evidence/`, 로고 검사 자료는 `ui-refresh/`를 사용한다. 문서의 대표 자료는 확인한 결과만 별도로 선별하므로 검사 재실행이 기존 비교 자료를 덮어쓰지 않는다. `/tmp`에 쓰는 진단 화면도 커밋 대상이 아니다.

`verify-motion-ui.js`는 production 청크 전환을 검사하므로 별도로 웹 디렉터리에서 `pnpm build` 후 `pnpm preview --host localhost --port 4173 --strictPort`를 실행해야 한다. 개발 서버 5173만으로는 실행할 수 없다. 이 스크립트는 QA 노트 90·95, `verify-list-ui.js`는 QA 노트 95가 있는 기존 테스트 계정에 종속된다. 새 환경에서는 본인 소유의 일회용 QA 노트를 준비하고 스크립트의 ID와 예상 내용을 맞춘 뒤 실행한다. 같은 번호의 실제 사용자 노트를 검사 대상으로 사용하지 않는다. 두 서버가 같은 로컬 API 설정을 사용하고 QA 계정 인증이 유효한지도 먼저 확인한다.

```sh
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-main-ui.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-editor-ui.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-list-ui.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-ime-delete.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-graph-ui.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-graph-camera.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-loading-logo.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-copy-states.js
playwright-cli -s=sb-foundation run-code --filename=frontend/secondbrain/checks/verify-motion-ui.js
```

| 스크립트 | 확인하는 범위와 데이터 경계 |
| --- | --- |
| `verify-main-ui.js` | 목록·검색·삭제 확인·메뉴·포커스. recent/search/삭제와 500 응답을 합성하며, 실제 서버 삭제 증거가 아니다. |
| `verify-editor-ui.js` | 별도 QA 노트를 실제 서버에 생성·수정하고 GET·새로고침으로 확인한다. 작은 PNG의 실제 픽셀, 큰 파일·SVG 거절도 검사한다. 수정 저장 500과 ClipboardEvent·drop은 합성이다. 결과의 QA 노트 ID를 확인해 만든 데이터만 별도로 정리한다. |
| `verify-list-ui.js` | 기존 QA 노트 95의 풍부한 목록을 읽기만 하고, 새 QA 노트에서 목록 구조·Tab/Shift+Tab·undo/redo·할 일 체크·실제 서버 승격/GET을 확인한다. 기존 QA 노트 95가 있어야 실행할 수 있다. 새로 만든 노트 ID를 결과에서 확인한다. 스크립트의 키보드 검사는 실제 포인터 블록 드래그나 macOS 한글 입력을 증명하지 않는다. |
| `verify-ime-delete.js` | Chrome Input 프로토콜의 조합·입력 직후 닫기와 실제 GET·DELETE·404를 확인한다. macOS 운영체제 한글 입력기 검사는 아니다. |
| `verify-graph-ui.js` | 별도 페이지에서 저장 48노드·AI 500→재시도·검색·390px 조작을 합성한다. 실제 AI worker와 저장소 지속성의 증거는 아니다. |
| `verify-graph-camera.js` | 별도 BrowserContext에서 인증·저장/AI 응답을 합성한다. 저장 노드 2·3·48개를 desktop/390px에서 렌더러 준비 직후와 5초 후에 투영해 가시성을 검사한다. 48노드에서는 확대·축소·전체 보기·먼 거리 상한과 되돌리기를 실제 버튼으로 확인한다. 3노드의 저장 조회 500·재시도, 빈 화면→1노드, 같은 ID 제목 변경과 ID 전체 교체의 카메라 반응도 확인한다. 검사에서만 React 내부 참조로 공개 ForceGraph3D 인스턴스에 접근하므로 앱 코드 계약이나 실제 서버 지속성의 증거로 쓰지 않는다. 실제 사용자 계정의 노드 표시와 확대·축소 조작은 별도 Chrome 확인이 필요하다. |
| `verify-loading-logo.js` | 일회용 같은 출처 페이지에서 실제 `LoadingSpinner`와 현재 47점 렌더러의 프레임·영상·축소 모션·숨김·정리·Canvas 대체를 확인한다. 앱 경로의 로딩 통합은 별도 검사로 확인한다. |
| `verify-copy-states.js` | 합성 응답으로 저장 노트 조회 중·정상 빈 상태·조회 실패와 재시도·검색 결과 없음을 구분한다. 격리된 로그아웃 브라우저 문맥에서 원본 로고·제품명·로그인 버튼과 320/390px 배치를 확인한다. OAuth 도착지만 가로채므로 Google 제공자 로그인 검사는 아니다. 노트는 쓰지 않는다. |
| `verify-motion-ui.js` | 인증된 QA의 실제 GET 데이터에 API·편집기 모듈 지연을 합성해 메인·목록·노트·390px의 로딩 중심, 같은 Canvas의 데이터→모듈 전환, 준비 뒤 콘텐츠 표시를 확인한다. 실제 포인터·메뉴·크기 변경, 빠른 왕복 조작, 늦은 응답, 동작 줄이기도 검사한다. 노트 작성·수정·삭제는 하지 않는다. 합성 지연은 실제 네트워크 속도 측정이 아니다. 그래프 카메라의 최종 검사는 별도다. |

검사가 생성한 QA 노트, 라우트 가로채기, 별도 페이지의 정리 상태를 실행 결과에서 확인한다. 합성 응답과 실제 서버 GET/DELETE를 같은 성공 항목으로 합치지 않는다.
