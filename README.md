# Second Brain Personal

기존 팀 프로젝트를 바탕으로 개인 PC에서 개발하고 사용하는 지식 관리 프로그램입니다.

## 개발 환경 정비

웹·확장·AI·MCP의 의존성 최신화(PR #2)를 master에서 가져오고, 백엔드 최신화·로컬 실행 구성·배포 및 모바일 제거 변경을 통합했습니다. 각 모듈의 버전 선택과 실제 검증 범위는 해당 README에 기록합니다.

| 영역 | 실행 기준 | 상세 기록 |
| --- | --- | --- |
| 웹·확장 | Node 26.10.0, pnpm 12.6.0, React 19.3, Vite 8.3, TypeScript 6.0.3 | [웹](frontend/secondbrain/README.md), [확장](extension/README.md) |
| 백엔드 | Java 26.0.2.1+1, Gradle 9.7.1, Spring Boot 4.1.1 | [백엔드](backend/secondbrain/README.md) |
| AI·MCP | Python 3.14.7, uv 0.12.18, FastMCP 4.0.8 | [AI](knowledge-graph-service/README.md), [MCP](agent-MCP/README.md) |

TypeScript 7은 최신 typescript-eslint의 지원 범위 때문에 6.0.3으로, Java 27은 Gradle·Spring의 지원 상한 때문에 26으로 제한했습니다. 코드 수정량을 이유로 이전 버전을 유지한 것이 아니며, 관련 근거는 모듈 문서에 있습니다.

## 로컬 실행

- 웹 프론트엔드: PC에서 Node/pnpm으로 실행합니다.
- PostgreSQL·Redis·Elasticsearch·RabbitMQ·Neo4j: Docker Desktop의 Compose로 실행합니다.
- 백엔드·AI API·워커: 필요한 프로필을 선택해 컨테이너로 실행합니다.
- Jenkins, DockerHub 업로드, Blue/Green, 운영 Nginx/인증서, Grafana/Prometheus 구성은 제거했습니다.

상세 명령, 환경변수, CPU/메모리 제한, 검증 범위는 [로컬 개발 README](infra/local/README.md)에 있습니다.

```sh
cp infra/local/.env.example infra/local/.env
docker compose --env-file infra/local/.env --profile backend up -d --build --wait
```

프론트엔드는 [웹 README](frontend/secondbrain/README.md)를 따라 실행합니다. 백엔드는 `http://localhost:8080`, AI API는 `http://localhost:8000`, 웹은 `http://localhost:5173`을 사용합니다. Google 로그인과 외부 AI/S3/TTS 기능에는 별도 자격증명이 필요합니다.

## 작업 범위

- 최신 서비스 이미지, Compose 프로필과 CPU·메모리 제한, 백엔드·AI Dockerfile을 관리합니다.
- 웹·확장·MCP의 API·AI 직접 연결 주소와 로컬 실행 설정을 관리합니다.
- 백엔드의 의존성·Gradle·SDK 이전·테스트·선택 근거를 함께 관리합니다. [백엔드 README](backend/secondbrain/README.md)
- 웹·확장·AI·MCP 의존성 버전·잠금 파일은 선행 최신화 작업에서 가져왔습니다.
- 상세 UI/UX 개편, 기존 기능 버그 수정과 실제 OAuth·유료 모델 연결 검증은 후속 작업입니다.

## 개발 도구와 커밋 규칙

Follow the shared quality standards and completion criteria in [AGENTS.md](AGENTS.md), and consult the `.agents/skills/` guidance relevant to the change. The [development standards audit](docs/development-standards-audit.md) records how the 82 legacy files were assessed, the verified versions, and the validation results.

Playwright CLI 공식 스킬은 `.agents/skills/playwright-cli/`에 있으며 실행 결과물 `.playwright-cli/`는 Git에서 제외합니다. 공통 commitlint는 `type(scope): 한국어 설명` 형식을 검사합니다. 새 clone과 각 worktree에서의 훅 활성화 방법 및 모듈 scope는 [커밋 규칙](docs/commit-conventions.md)을 따릅니다. 타입 검사·린트·빌드는 메시지 검사와 별도로 실행합니다.

## 모바일·Wear OS 제거

Android·Wear OS 앱(`mobile_watch/`)과 모바일 전용 인증 컨트롤러를 이 작업트리에서 제거했습니다. 원본은 Git 이력의 `d028910`에 보존되어 있으며 공용 웹·확장 인증 코드는 유지합니다.

## 이전 팀 프로젝트

기존 기능 소개·팀원 기여·프로젝트 산출물은 [팀 프로젝트 기록](docs/team-project-history.md)에 보존했습니다. 해당 문서의 서버 배포 설명은 과거 기록입니다.
