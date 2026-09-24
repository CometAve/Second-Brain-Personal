# 커밋 규칙

```text
type(scope): 한국어 설명
```

`type`은 변경 목적, `scope`는 변경한 모듈입니다. 저장소 공통 변경은 scope를 생략합니다.

| Scope | 대상 |
| --- | --- |
| `frontend` | 웹 프론트엔드 |
| `extension` | 브라우저 확장 |
| `backend` | 백엔드 |
| `knowledge-graph-service` | AI 지식 그래프 서비스 |
| `agent-MCP` | MCP 서버 |
| `infra` | Docker Compose 등 실행 인프라 |

- Type: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `style`, `chore`, `revert`
- Scope는 표의 식별자 하나를 정확히 사용합니다. `[FE]` 접두사와 `FE`, `BE`, `AI` 같은 별칭은 사용하지 않습니다.
- 제목과 본문의 자연어 설명은 한국어로 작성합니다. 라이브러리명과 API명 등 기술 식별자는 유지합니다.
- 제목은 마침표 없이 100자 이내로 작성합니다. 본문은 필요한 경우에만 빈 줄 뒤에 작성합니다.
- 호환성을 깨뜨리는 변경은 `type(scope)!:` 또는 `type!:`로 표시합니다.
- 하나의 커밋에는 함께 검토하고 되돌릴 수 있는 변경을 묶습니다. 의존성 변경과 이에 필요한 API 이전, 잠금 파일, 검증은 함께 둡니다.

```text
build(frontend): 웹 의존성과 빌드 환경 업데이트
build(agent-MCP): FastMCP 실행 설정 이전
chore(infra): 로컬 실행 프로필 구성
docs: 개발 환경 설정 방법 추가
```

## 설치와 검사

웹 또는 확장의 `.nvmrc`에 맞는 Node와 `packageManager`에 지정된 pnpm을 사용해 해당 모듈의 의존성을 설치합니다. 루트에 별도의 의존성 트리는 만들지 않습니다.

일반적인 로컬 clone에서 아래 명령을 한 번 실행합니다. 연결된 worktree에는 필요한 곳에서 두 번째 명령을 각각 실행합니다.

```sh
git config --local extensions.worktreeConfig true
git config --worktree core.hooksPath .githooks
```

`core.hooksPath`는 현재 worktree에만 설정합니다. 의존성 설치 시 Husky가 공유 Git 설정을 덮어쓰지 않도록 웹·확장의 자동 `prepare`는 제거했습니다.

활성 훅은 `.githooks/commit-msg`입니다. 루트의 공통 설정으로 메시지를 검사하며 웹, 확장 순서로 설치된 commitlint를 찾습니다. 미설치 상태에서는 안내 후 커밋을 중단하고 패키지를 자동 다운로드하지 않습니다. 두 모듈의 commitlint 설정도 같은 공통 설정을 참조합니다.

```sh
# 웹 디렉터리에서 메시지만 검사
printf '%s\n' 'build(frontend): 빌드 환경 업데이트' | pnpm exec commitlint
```

제목에 한글이 포함되어 있는지 자동 검사하지만, 문장 전체의 언어와 의미까지 판별하지는 않습니다. Git이 만드는 merge·revert 메시지는 commitlint의 기본 예외를 따릅니다.

기존 모듈별 `.husky`의 pre-commit·pre-push는 이 설정에서 활성화하지 않습니다. 타입 검사·린트·빌드는 각 모듈의 명령으로 실행합니다. 메시지 검사를 통과했다는 이유만으로 코드 검증을 완료한 것으로 간주하지 않습니다.
