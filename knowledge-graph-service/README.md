## Knowledge Graph Service

간단하고 실용적으로 정리한 리포지토리 설명서입니다. 이 프로젝트는 개인 노트를 임베딩하고 유사도 기반으로 노트들을 연결해 Neo4j 지식 그래프를 구성합니다.

이 작업 공간은 Python 의존성 최신화를 담당합니다. Docker·Compose 실행 구성은 후속 `codex/local-compose`에 있으며, 최신화 변경을 통합한 뒤 사용합니다. 이 작업 공간에 남아 있는 기존 Docker 설정을 최신 Python 조합의 검증된 실행 구성으로 취급하지 않습니다.

현재 상태
- API 서버 (FastAPI) 동작
- 워커(Background consumer) 구성 완료 — RabbitMQ로 메시지를 받아 처리합니다

주요 변경/간소화
- 실행 Python 버전: 3.14.7 (3.14 계열)

기술 스택(요약)
- Python 3.14.7
- FastAPI, Uvicorn
- Neo4j Python Driver 6.3.1
- RabbitMQ + pika (워커에서 사용)
- 의존성 관리: `uv` (pyproject.toml, uv.lock)

프로젝트 핵심 파일
- `main.py` — FastAPI 진입점
- `worker.py` — 워커 실행 스크립트 (app.workers.note_consumer 사용)
- `pyproject.toml`, `uv.lock` — 의존성

빠른 시작 (개발)
1) 의존성 설치

```bash
uv sync --locked --no-install-project
```

2) 로컬 실행 (API)

```bash
uv run --locked python main.py
# 서버: http://localhost:8000/ai
```

3) 로컬 워커 실행

```bash
uv run --locked python worker.py
```

## 2026-09-24 의존성 기준

Python은 `.python-version`에서 **3.14.7**, uv는 `pyproject.toml`에서 **0.12.18**로 지정합니다. `pyproject.toml`은 검증한 Python 3.14 계열만 허용합니다. API·워커 이미지의 런타임 변경은 후속 `codex/local-compose`에 포함됩니다.

| 패키지 | 고정 버전 |
|---|---|
| FastAPI / Uvicorn | 0.141.1 / 0.53.0 |
| Pydantic / pydantic-settings | 2.13.5 / 2.15.0 |
| Neo4j Driver / pika | 6.3.1 / 1.4.4 |
| LangChain / langchain-core / langchain-openai | 1.4.2 / 1.6.4 / 1.6.5 |
| LangGraph / OpenAI / tiktoken | 1.2.12 / 3.19.2 / 0.14.0 |
| HTTPX / python-dotenv / python-multipart | 0.28.1 / 1.2.3 / 0.0.32 |
| trafilatura / IPython / typing-extensions | 2.2.0 / 9.17.1 / 4.16.0 |
| pytest / pytest-asyncio (dev extra) | 9.1.1 / 1.4.0 |
| setuptools / wheel (build backend) | 84.0.0 / 0.48.0 |

버전은 [Python 공식 릴리스](https://www.python.org/downloads/release/python-3147/)와 [PyPI](https://pypi.org/)의 안정 릴리스를 기준으로 확인했습니다. 전이 의존성은 `uv.lock`에 고정하며, 다시 실행할 때 `--locked`를 사용합니다. uv 버전이 다르면 `pyproject.toml`의 `required-version` 검사에서 중단됩니다.

OpenAI 3은 별도 패키지인 HTTPX2를 사용합니다. 자체 백엔드 호출은 최신 HTTPX 0.28.1을 계속 사용하며 두 패키지는 함께 설치됩니다. LangChain 1.4.2가 요구하는 core·LangGraph 범위와 langchain-openai 1.6.5의 OpenAI `<4` 범위를 함께 충족합니다. Neo4j Driver 6은 Neo4j 서버 5.x와 2026.x를 지원합니다. [OpenAI 패키지](https://pypi.org/project/openai/3.19.2/), [LangChain OpenAI 패키지](https://pypi.org/project/langchain-openai/1.6.5/), [Neo4j 호환성](https://neo4j.com/docs/python-manual/current/install/)

개발용 pytest는 optional extra이므로 다음과 같이 설치합니다. `--no-dev`는 optional extra를 설치하는 옵션이 아닙니다.

```bash
uv lock --check
uv sync --locked --extra dev --no-install-project
```

다음은 최신화와 로컬 실행 변경을 함께 적용했을 때의 검증 기록입니다. Python 3.14.7의 Mac ARM·Linux ARM에서 의존성 해석을 확인했습니다. Mac의 별도 가상환경에서 실제 설치, OpenAI 임베딩 모의 요청·응답, 현재 세 structured-output 스키마 생성, LangGraph `compile`·`ainvoke`를 확인했습니다. DB 연결을 모의 객체로 대체한 API·워커 import, 실제 OpenAPI 경로 생성, `TestClient`의 `/ai/health` 200 응답도 확인했습니다. 실제 자격증명·LLM API는 사용하지 않았습니다. 토크나이저 지연 초기화와 Docker·DB 연결 검증은 `codex/local-compose`에 속하며, 현재 분리된 최신화 작업 트리의 단독 기동 검증을 의미하지 않습니다.

알려진 기존 제약은 이번 버전 변경에서 수정하지 않았습니다.

- 두 에이전트의 `models.py`는 `OPENAI_BASE_URL`을 문자열로 전제합니다. 설정을 생략하면 환경 변수 대입이 실패하므로 사용할 API 주소를 명시해야 합니다.
- 일부 기존 테스트는 실제 Neo4j·RabbitMQ·LLM에 연결하는 통합 스크립트이며, 과거 `/health`·`/api/v1` 경로를 사용합니다. 현재 실제 경로는 `/ai/health`·`/ai/api/v1`입니다. 전체 pytest 실행을 외부 연결 없는 단위 테스트로 취급하지 않습니다.
- 일부 Pydantic 모델의 class 기반 `Config`는 기존 deprecated 사용입니다. 이번 작업에서는 경고를 숨기는 설정을 추가하지 않았습니다.
- 현재 최신 LangSmith의 `asyncio.iscoroutinefunction` 사용도 Python 3.14에서 deprecation 경고를 냅니다. 실행 검사는 통과했으며, 향후 upstream 변경을 확인해야 합니다.

## 🎯 주요 기능 설명

### 1. 자동 임베딩 생성

- 노트 작성시 노트 내용에 대해 자동으로 임베딩 벡터값이 계산되어 저장됩니다.

### 2. 유사도 기반 자동 연결

```
새 노트 A 생성
     ↓
벡터 인덱스 검색 (HNSW)
     ↓
Top-20 유사 노트 추출 (코사인 유사도)
     ↓
임계값 필터링 (score ≥ 0.70)
     ↓
최대 10개 관계 생성 (SIMILAR_TO)
     ↓
양방향 관계 설정 (A ↔ B)
```
### 3. 요약 에이전트
- 크롬 익스텐션을 통해 url / text 데이터를 종합해 하나의 note로 저장하는 에이전트
- url을 가져와 파싱하고 / text데이터와 종합해 LLM활용해서 새로운 노트로 생성

### 4. 노트 검색 에이전트
- 사용자가 찾고자하는 또는 궁금한 내용을 내가 저장한 SecondBrain에서 찾아주는 에이전트
- 자연어로 입력하면 알맞은 필터를 적용하는 **동적쿼리**작성 Agent구축(예시: 시간 범위)
- 유사도 검색을 위한 검색 쿼리 재작성 이후 관련성 체크하는 Agent
- 최종 응답 생성 Agent
- Agent 오케스트라 : LangGraph 활용

![alt text](/knowledge-graph-service/docs/image.png)

### 5. 그래프 관련 API
- 그래프 시각화를 위한 Neo4j 그래프 데이터 제공
- 이웃 노드 조회
- MCP 활용 그래프 검색 제공 


## ⚙️ 설정 옵션

### config.py 주요 설정

| 설정 | 기본값 | 설명 |
|-----|-------|------|
| `SIMILARITY_THRESHOLD` | 0.70 | 관계 생성 최소 유사도 |
| `MAX_RELATIONSHIPS` | 10 | 노트당 최대 연결 수 |

### 임계값 조정 가이드
* 임시로 작성되었습니다 - 아직 확인된 내용 아님
- **0.80 이상**: 거의 동일한 주제 (매우 엄격)
- **0.70 - 0.79**: 유사한 주제 (권장)
- **0.60 - 0.69**: 관련된 주제 (느슨함)
- **0.60 미만**: 관련 없음

### 비동기 처리 추가

```
Spring Boot Backend
     ↓ (노트 저장)
PostgreSQL
     ↓ (메시지 발행)
RabbitMQ
     ↓ (메시지 수신)
Knowledge Graph Service
     ↓
Neo4j
```
