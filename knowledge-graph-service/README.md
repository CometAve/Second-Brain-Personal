## Knowledge Graph Service

간단하고 실용적으로 정리한 리포지토리 설명서입니다. 이 프로젝트는 개인 노트를 임베딩하고 유사도 기반으로 노트들을 연결해 Neo4j 지식 그래프를 구성합니다.

현재 상태
- API 서버 (FastAPI) 동작
- 워커(Background consumer) 구성 완료 — RabbitMQ로 메시지를 받아 처리합니다

주요 변경/간소화
- 실행 Python 버전: 3.14.7 (3.14 계열)

## Gemini on Google Cloud

요약, 검색 에이전트, 임베딩은 Google Cloud Vertex AI의 Gemini를 사용합니다. `GOOGLE_CLOUD_PROJECT`는 필수이고 `GOOGLE_CLOUD_LOCATION`은 기본값 `global`입니다. 인증은 Application Default Credentials(ADC)를 사용합니다. 로컬이나 컨테이너에서는 `GOOGLE_APPLICATION_CREDENTIALS`로 ADC 파일을 지정할 수 있습니다. API 키를 사용하지 않습니다.

| 설정 | 기본값 | 용도 |
|---|---|---|
| `SUMMARIZE_MODEL` | `gemini-3.8-flash` | 노트 요약 |
| `SEARCH_AGENT_MODEL` | `gemini-3.7-flash` | 검색 에이전트의 분류·관련성 판단·응답 생성 |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` | 1536차원 노트 및 검색 임베딩 |
| `RABBITMQ_QUEUE` | `note_creation_queue` | 워커가 소비할 큐 |

노트는 `title: {title or "none"} | text: {content}`, 검색은 `task: search result | query: {query}` 형식으로 임베딩합니다. Gemini Embedding 2 요청은 `task_type`을 사용하지 않고 출력 차원을 1536으로 지정합니다. Neo4j 노트에 `embedding_model` 값을 기록하고 같은 모델·형식으로 만든 벡터만 유사도 검색에 포함합니다. 이전 모델의 벡터는 자동 변환되지 않으므로 새 모델로 다시 생성해야 합니다.

Gemini 3.8은 `temperature`, `top_p`, `candidate_count`를 받지 않습니다. 고정된 `langchain-google-genai` 4.4.0이 기본값으로 넣는 `candidate_count=1`은 서비스 어댑터에서 제외합니다. 어댑터 버전을 올릴 때 이 요청 계약을 다시 확인해야 합니다. 검색에는 별도 모델 설정을 사용하므로 요약 모델을 변경하지 않고 검색 응답 시간을 조정할 수 있습니다.

워커는 처리 실패 시 메시지를 재큐잉하고 소비를 중지합니다. 원인을 해결한 뒤 재시작해야 하며, 알 수 없는 이벤트도 조용히 폐기하지 않습니다. 동일한 노트 생성 이벤트를 재처리해도 기존 노드를 갱신합니다.

기술 스택(요약)
- Python 3.14.7
- FastAPI, Uvicorn
- Neo4j Python Driver 6.3.1 (서버 버전은 루트 Compose 참조)
- RabbitMQ + pika (워커에서 사용)
- 의존성 관리: `uv` (pyproject.toml, uv.lock)

프로젝트 핵심 파일
- `main.py` — FastAPI 진입점
- `worker.py` — 워커 실행 스크립트 (app.workers.note_consumer 사용)
- `pyproject.toml`, `uv.lock` — 의존성
- `Dockerfile`, `Dockerfile.worker` — API/워커 컨테이너 설정 (실행 구성은 저장소 루트 Compose에서 관리)

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

도커 실행은 [저장소 루트 README](../README.md)의 로컬 환경 준비 절차를 따릅니다. 기존 서비스별 Compose는 루트 구성으로 통합했습니다.

저장소 루트에서 API와 워커 실행 및 상태 확인:

```bash
docker compose --env-file infra/local/.env up --build -d --wait ai worker
docker compose --env-file infra/local/.env exec ai python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/ai/health').read().decode())"
docker compose --env-file infra/local/.env logs -f ai worker
```

API와 워커는 Neo4j가 준비된 뒤 실행해야 하며, 워커는 RabbitMQ와 백엔드도 필요합니다. 위 명령은 선언된 의존 서비스를 함께 실행합니다. API는 단일 프로세스로 실행합니다. 컨테이너는 `uv==0.12.18`과 잠금 파일 `uv.lock`을 사용하고, 실제 `.env` 파일은 이미지에 포함하지 않습니다.

기동 및 `/ai/health` 확인은 LLM API나 tokenizer 다운로드를 호출하지 않습니다. 합성 자격증명으로 상태 확인은 가능하지만, 임베딩·요약·자연어 검색에는 실제 모델 API 설정이 필요합니다. 합성 자격증명 상태에서는 노트 생성·수정 이벤트 처리까지 성공한 것으로 간주하면 안 됩니다.

## 2026-09-24 의존성 기준

Python은 `.python-version`과 두 Dockerfile에서 **3.14.7**, uv는 `pyproject.toml`과 Dockerfile에서 **0.12.18**로 지정합니다. `pyproject.toml`은 검증한 Python 3.14 계열만 허용합니다. API·워커 이미지는 동일한 `python:3.14.7-slim-trixie`와 공식 uv 이미지를 사용합니다. [uv Docker 가이드](https://docs.astral.sh/uv/guides/integration/docker/)

| 패키지 | 고정 버전 |
|---|---|
| FastAPI / Uvicorn | 0.141.1 / 0.53.0 |
| Pydantic / pydantic-settings | 2.13.5 / 2.15.0 |
| Neo4j Driver / pika | 6.3.1 / 1.4.4 |
| LangChain / langchain-core / langchain-google-genai | 1.4.2 / 1.6.4 / 4.4.0 |
| LangGraph / google-genai | 1.2.12 / 2.25.0 |
| HTTPX / python-dotenv / python-multipart | 0.28.1 / 1.2.3 / 0.0.32 |
| trafilatura / IPython / typing-extensions | 2.2.0 / 9.17.1 / 4.16.0 |
| pytest / pytest-asyncio (dev extra) | 9.1.1 / 1.4.0 |
| setuptools / wheel (build backend) | 84.0.0 / 0.48.0 |

버전은 [Python 공식 릴리스](https://www.python.org/downloads/release/python-3147/)와 [PyPI](https://pypi.org/)의 안정 릴리스를 기준으로 확인했습니다. 전이 의존성은 `uv.lock`에 고정하며, 다시 실행할 때 `--locked`를 사용합니다. uv 버전이 다르면 `pyproject.toml`의 `required-version` 검사에서 중단됩니다.

LangChain 1.4.2, core 1.6.4, langchain-google-genai 4.4.0을 함께 고정했습니다. 임베딩은 `google-genai` 2.25.0을 직접 사용합니다. Neo4j Driver 6은 Neo4j 서버 5.x와 2026.x를 지원합니다. [Google Gen AI Python SDK](https://googleapis.github.io/python-genai/), [Neo4j 호환성](https://neo4j.com/docs/python-manual/current/install/)

개발용 pytest는 optional extra이므로 다음과 같이 설치합니다. `--no-dev`는 optional extra를 설치하는 옵션이 아닙니다.

```bash
uv lock --check
uv sync --locked --extra dev --no-install-project
```

다음은 2026-09-24에 이전 OpenAI 구성의 의존성과 로컬 실행을 확인한 과거 검증 기록입니다. Python 3.14.7의 Mac ARM·Linux ARM에서 의존성 해석을 확인했습니다. Mac의 별도 가상환경에서 실제 설치, OpenAI 임베딩 모의 요청·응답, 당시 세 structured-output 스키마 생성, LangGraph `compile`·`ainvoke`를 확인했습니다. DB 연결을 모의 객체로 대체한 API·워커 import, 실제 OpenAPI 경로 생성, `TestClient`의 `/ai/health` 200 응답도 확인했습니다. 실제 자격증명·LLM API는 사용하지 않았습니다. Docker 전체 기동과 실제 DB 연결 검증은 [로컬 환경 검증 기록](../infra/local/README.md)을 따릅니다. 이 기록은 실제 자격증명을 사용하는 노트 이벤트 처리나 검색 품질을 검증한 결과는 아닙니다.

2026-09-24 master 통합 후 API·워커 import, OpenAPI 경로, 모의 DB 조건의 `/ai/health` 200을 다시 확인했습니다. 이때 외부 소켓 연결과 기동 시 tokenizer 로드를 차단했습니다. 토큰 계산을 처음 요청할 때 한 번 초기화하고 다음 요청에서 재사용하는 동작도 모의 tokenizer로 확인했습니다. 실제 DB lifespan 기동과 LLM 요청은 이 검사에 포함하지 않습니다.

알려진 기존 제약은 이번 버전 변경에서 수정하지 않았습니다.

- 일부 기존 테스트는 실제 Neo4j·RabbitMQ·LLM에 연결하는 통합 스크립트이며, 과거 `/health`·`/api/v1` 경로를 사용합니다. 현재 실제 경로는 `/ai/health`·`/ai/api/v1`입니다. 전체 pytest 실행을 외부 연결 없는 단위 테스트로 취급하지 않습니다.
- 일부 Pydantic 모델의 class 기반 `Config`는 기존 deprecated 사용입니다. 이번 작업에서는 경고를 숨기는 설정을 추가하지 않았습니다.
- 현재 최신 LangSmith의 `asyncio.iscoroutinefunction` 사용도 Python 3.14에서 deprecation 경고를 냅니다. 실행 검사는 통과했으며, 향후 upstream 변경을 확인해야 합니다.

- Neo4j 2026.09의 `db.index.vector.queryNodes`는 deprecated 상태이지만 현재 작동합니다. 실제 최신 서버에서 합성 1536차원 벡터의 인덱스 생성·검색·삭제를 검증했으며, Cypher 검색 구문 전환은 후속 작업으로 남깁니다.

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
