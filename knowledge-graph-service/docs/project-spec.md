# 📚 Knowledge Graph Service - 프로젝트 스펙 & 진행상황

> 이 문서는 2025년 팀 프로젝트의 설계·진행 기록입니다. 아래 버전표와 Docker 명령은 현재 실행 기준이 아닙니다. 현재 의존성 기준은 [서비스 README](../README.md)를 따릅니다.

> Neo4j 기반 의미론적 유사도 분석을 통해 개인 노트를 자동으로 연결하는 지식 그래프 구축 시스템

**작성일**: 2025-11-03  
**상태**: Phase 4 완료 (1차 MVP 완료)  
**다음 단계**: Phase 5 - 비동기 처리 + RabbitMQ

---

## 📋 프로젝트 개요

### 핵심 목표
사용자가 작성한 노트들을 자동으로 임베딩하고, 의미론적 유사도를 기반으로 관련 노트들을 자동 연결하여 지식 그래프를 구축

### 주요 특징
- ✅ **자동 임베딩**: OpenAI API (text-embedding-3-small, 1536차원)
- ✅ **벡터 기반 검색**: HNSW 인덱스 + 코사인 유사도
- ✅ **자동 관계 형성**: 임계값 기반 필터링 (기본: 0.70)
- ✅ **사용자 격리**: 다중 사용자 지원 (Multi-tenant)
- ✅ **REST API**: FastAPI 기반
- ✅ **컨테이너 배포**: Docker + uv

---

## 🎯 프로젝트 진행 상황

### Phase 1: Neo4j 기본 설정 ✅ (완료)

**목표**: Neo4j 데이터베이스 연결 및 스키마 구성

**완료 내용**:
- Neo4j 5.26 버전 설정
- Bolt 프로토콜 연결 (포트 7687)
- 스키마 자동 초기화
  - Note 노드: 노트 데이터 저장
  - SIMILAR_TO 관계: 유사도 정보 저장
- 벡터 인덱스 설정 (HNSW)

**주요 파일**:
- `app/db/neo4j_client.py`: Neo4j 연결 관리
- `app/db/init_db.py`: 스키마 초기화

**테스트**: Neo4j 연결 확인 ✅

---

### Phase 2: CRUD 작업 및 데이터 접근 ✅ (완료)

**목표**: 노트의 생성, 조회, 수정, 삭제 기능 구현

**완료 내용**:
- **Create**: 노트 생성 (user_id, note_id, title, embedding)
- **Read**: 
  - 단일 노트 조회
  - 목록 조회 (페이지네이션)
  - 제목 검색
  - 유사 노트 조회
- **Delete**: 노트 삭제 (관계 포함)
- **유저 격리**: 모든 쿼리에 user_id 필터 적용

**주요 파일**:
- `app/crud/note.py`: CRUD 작업 구현

**테스트**: 9개 테스트 모두 통과 ✅
- 노트 생성
- 노트 조회
- 노트 목록 조회
- 노트 삭제
- 유저 격리
- DateTime 변환

---

### Phase 3: 임베딩 서비스 & 유사도 연결 ✅ (완료)

**목표**: OpenAI API 임베딩 생성 및 유사도 기반 자동 연결

**완료 내용**:

#### 3-1. 임베딩 서비스
- OpenAI API 호출 (text-embedding-3-small)
- 1536차원 벡터 생성
- 토큰 계산 및 로깅
- 프록시 서버 지원

**주요 파일**: `app/services/embedding_service.py`

#### 3-2. 유사도 서비스
**흐름**:
```
노트 A 생성 (임베딩 완료)
    ↓
HNSW 벡터 인덱스에서 Top-20 검색
    ↓
코사인 유사도 계산
    ↓
임계값 필터링 (score ≥ 0.70)
    ↓
최대 10개 관계 생성 (SIMILAR_TO)
    ↓
양방향 관계 설정
```

**기능**:
- 유사 노트 검색 (벡터 기반)
- 자동 관계 생성
- 관계 삭제
- 통계 조회

**주요 파일**: `app/services/similarity_service.py`

**테스트**: 6개 테스트 모두 통과 ✅
- 유사 노트 검색
- 관계 생성
- 관계 삭제
- 연결 개수 조회
- 유저 통계
- 유저 격리

---

### Phase 4: API 엔드포인트 & 배포 ✅ (완료)

**목표**: FastAPI 기반 REST API 구현 및 Docker 배포

#### 4-1. API 엔드포인트 구현

**노트 관련** (`/api/v1/notes`):
- `POST /notes`: 노트 생성
- `GET /notes`: 노트 목록
- `GET /notes/{note_id}`: 노트 상세 조회
- `DELETE /notes/{note_id}`: 노트 삭제

**검색 관련** (`/api/v1/search`):
- `GET /search/by-title`: 제목 검색

**통계 관련** (`/api/v1/stats`):
- `GET /stats`: 그래프 통계

**주요 파일**:
- `app/api/v1/endpoints/notes.py`
- `app/api/v1/endpoints/search.py`
- `app/api/v1/endpoints/stats.py`
- `app/api/v1/routers.py`: 라우터 통합
- `app/api/v1/dependencies.py`: 의존성 주입

#### 4-2. 로깅 최적화

- 환경별 로그 레벨 (DEBUG, INFO, WARNING, ERROR)
- 프로덕션: WARNING (경고만 출력)
- 개발: INFO (일반 정보 포함)

#### 4-3. Docker 배포

**Dockerfile**:
- Multi-stage build (Builder + Runtime)
- uv 패키지 관리자 사용
- 최소 이미지 크기
- 헬스 체크 포함

**docker-compose.yml**:
- FastAPI 컨테이너만 (Neo4j는 외부)
- 환경변수 관리 (.env 파일)
- 볼륨 마운트 (개발용)

**테스트**: 10개 API 테스트 모두 통과 ✅
- 헬스 체크
- 노트 생성
- 노트 조회
- 노트 목록
- 검색
- 통계
- 에러 처리

---

## 🛠️ 기술 스택 (최신)

### 코어 기술

| 기술 | 버전 | 목적 |
|------|------|------|
| **FastAPI** | 0.120.0 | REST API 프레임워크 |
| **Python** | 3.11+ | 프로그래밍 언어 |
| **Neo4j** | 5.26 | 그래프 데이터베이스 |
| **OpenAI API** | 최신 | text-embedding-3-small |

### 패키지 관리 & 개발

| 도구 | 목적 |
|------|------|
| **uv** | 빠른 Python 패키지 관리자 |
| **pyproject.toml** | 의존성 정의 |
| **uv.lock** | 버전 고정 (재현 가능) |
| **pytest** | 단위 테스트 |
| **Docker** | 컨테이너 배포 |

### 핵심 의존성

```
# 프로덕션
fastapi==0.120.0
uvicorn[standard]==0.32.0
pydantic==2.9.2
pydantic-settings==2.6.1
neo4j==5.26.0
openai==1.54.4
tiktoken==0.8.0
python-dotenv==1.0.1
python-multipart==0.0.18
httpx==0.27.2

# 개발
pytest==8.3.3
pytest-asyncio==0.24.0
```

---

## 📁 디렉토리 구조 (최종)

```
knowledge-graph-service/
├── main.py                           # FastAPI 앱 엔트리포인트
├── Dockerfile                        # Docker 이미지
├── docker-compose.yml                # Docker Compose 설정
├── pyproject.toml                    # uv 의존성 정의
├── uv.lock                           # 의존성 잠금 파일 ⭐
├── .env.example                      # 환경변수 템플릿
├── .gitignore                        # Git 제외 파일
│
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── notes.py          # 노트 CRUD 엔드포인트
│   │       │   ├── search.py         # 검색 엔드포인트
│   │       │   └── stats.py          # 통계 엔드포인트
│   │       ├── routers.py            # 라우터 통합
│   │       └── dependencies.py       # 공통 헬퍼 (get_user_id)
│   │
│   ├── core/
│   │   ├── config.py                 # 환경 설정
│   │   └── constants.py              # 상수 정의
│   │
│   ├── db/
│   │   ├── neo4j_client.py           # Neo4j 클라이언트
│   │   └── init_db.py                # 스키마 초기화
│   │
│   ├── crud/
│   │   └── note.py                   # Note CRUD
│   │
│   ├── services/
│   │   ├── embedding_service.py      # OpenAI 임베딩
│   │   └── similarity_service.py     # 유사도 연결
│   │
│   └── schemas/
│       └── note.py                   # Pydantic 모델
│
├── tests/
│   ├── test_crud.py                  # CRUD 테스트 (9개)
│   ├── test_similarity_service.py    # 유사도 테스트 (6개)
│   └── test_api.py                   # API 통합 테스트 (10개)
│
└── README.md                         # 프로젝트 문서
```

---

## 📊 테스트 현황

### 전체 테스트 결과

| 카테고리 | 테스트 수 | 상태 |
|----------|----------|------|
| CRUD | 9개 | ✅ 통과 |
| 유사도 서비스 | 6개 | ✅ 통과 |
| API 통합 | 10개 | ✅ 통과 |
| **총합** | **25개** | **✅ 모두 통과** |

### 테스트 커버리지

- ✅ 기본 기능 (CRUD, 임베딩, 유사도)
- ✅ 에러 처리 (404, 400, 500)
- ✅ 유저 격리
- ✅ DateTime 변환
- ✅ 페이지네이션
- ✅ 벡터 검색

---

## 🔐 주요 설정

### 환경변수 (.env)

```
# Neo4j 연결 (외부 호스트)
NEO4J_URI=bolt://host.docker.internal:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# OpenAI API
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://gms.ssafy.io/gmsapi/api.openai.com/v1
OPENAI_MODEL=text-embedding-3-small

# 애플리케이션
SIMILARITY_THRESHOLD=0.70      # 유사도 임계값
MAX_RELATIONSHIPS=10           # 노트당 최대 연결 수
LOG_LEVEL=WARNING              # 프로덕션
```

### 주요 상수

```
# 임베딩
EMBEDDING_DIMENSION = 1536     # text-embedding-3-small
EMBEDDING_MODEL = "text-embedding-3-small"

# 유사도
SIMILARITY_THRESHOLD = 0.70    # 기본 임계값
MAX_RELATIONSHIPS = 10         # 최대 관계 수

# 페이지네이션
DEFAULT_PAGE_LIMIT = 20
MAX_PAGE_LIMIT = 100
DEFAULT_SEARCH_LIMIT = 20
```

---

## 🚀 배포 방식

### 로컬 개발

```
uv sync                 # 환경 설정
uv run python main.py   # 서버 실행
```

### Docker 배포

```
docker-compose build           # 이미지 빌드
docker-compose up -d           # 컨테이너 실행
docker-compose logs -f fastapi # 로그 확인
```

### 환경 설정 (중요!)

**Docker에서 localhost는 컨테이너 자신을 가리킴**:
- macOS/Windows: `NEO4J_URI=bolt://host.docker.internal:7687`
- Linux: 호스트 IP 사용 예: `bolt://192.168.1.100:7687`

---

## 📈 데이터 흐름

### 노트 생성 흐름

```
1️⃣ POST /api/v1/notes
   ├─ note_id, title, content 수신
   ├─ user_id (Header에서 추출)
   │
2️⃣ 임베딩 생성
   ├─ OpenAI API 호출
   ├─ 1536차원 벡터 생성
   ├─ 토큰 계산
   │
3️⃣ 노트 저장
   ├─ Neo4j에 저장
   ├─ embedding 벡터 포함
   ├─ user_id로 격리
   │
4️⃣ 유사도 연결
   ├─ HNSW 인덱스 검색
   ├─ Top-20 후보 추출
   ├─ 코사인 유사도 계산
   ├─ 임계값 필터링 (≥0.70)
   ├─ 최대 10개 관계 생성
   │
5️⃣ 응답
   └─ {note_id, embedding_dimension, linked_notes_count}
```

### 노트 조회 흐름

```
GET /api/v1/notes/{note_id}
  ├─ user_id 검증
  ├─ 노트 조회 (user_id로 필터)
  ├─ 유사 노트 조회
  └─ 응답 {note, similar_notes[]}
```

---

## 🔄 API 명세

### 엔드포인트 목록

| 메서드 | 경로 | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/v1/notes` | ✅ user_id | 노트 생성 |
| GET | `/api/v1/notes` | ✅ user_id | 목록 조회 |
| GET | `/api/v1/notes/{note_id}` | ✅ user_id | 상세 조회 |
| DELETE | `/api/v1/notes/{note_id}` | ✅ user_id | 삭제 |
| GET | `/api/v1/search/by-title` | ✅ user_id | 제목 검색 |
| GET | `/api/v1/stats` | ✅ user_id | 통계 |

### 요청/응답 예시

#### 노트 생성

**요청**:
```
POST /api/v1/notes
Headers: X-User-ID: user-123

Body:
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Neo4j 기초",
  "content": "Neo4j는 그래프 데이터베이스입니다..."
}
```

**응답**:
```
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "embedding_dimension": 1536,
  "linked_notes_count": 3
}
```

#### 노트 조회

**요청**:
```
GET /api/v1/notes/550e8400-e29b-41d4-a716-446655440000
Headers: X-User-ID: user-123
```

**응답**:
```
{
  "note_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "title": "Neo4j 기초",
  "created_at": "2025-11-03T12:00:00.000Z",
  "updated_at": null,
  "similar_notes": [
    {
      "note_id": "...",
      "title": "그래프 데이터베이스",
      "similarity_score": 0.82,
      "created_at": "2025-11-02T15:30:00.000Z"
    }
  ]
}
```

---

## 🎯 설정 및 상수

### 유사도 임계값 가이드

| 임계값 | 설명 | 사용 사례 |
|--------|------|----------|
| **0.80+** | 거의 동일 주제 | 엄격한 필터링 |
| **0.70-0.79** | 유사한 주제 | ✅ **기본** |
| **0.60-0.69** | 관련된 주제 | 느슨한 연결 |
| **0.60-** | 관련 없음 | 연결 안 함 |

### 로그 레벨

| 레벨 | 출력 | 용도 |
|------|------|------|
| DEBUG | 모든 로그 | 개발 환경 |
| INFO | ✅ 정보 + 상위 | 개발/테스트 |
| **WARNING** | ⚠️ 경고 + 에러 | **프로덕션** |
| ERROR | ❌ 에러만 | 엄격한 모니터링 |

---

## 📚 의존성 관리 (uv)

### 패키지 추가

```
uv add fastapi@latest          # 최신 버전
uv add "neo4j~=5.26"           # 호환성 범위
uv add --dev pytest@latest     # 개발 패키지
```

### 버전 업데이트

```
uv pip list --outdated         # 업데이트 가능한 패키지 확인
uv sync --upgrade              # 모든 패키지 업데이트
uv lock --upgrade-package fastapi  # 특정 패키지 업데이트
```

### Git 관리

```
# uv.lock은 Git에 커밋 (재현 가능한 환경)
git add pyproject.toml uv.lock

# .env는 제외 (민감정보)
# (이미 .gitignore에 설정됨)
```

---

## 🔮 Phase 5 계획 (다음 단계)

### 목표: 비동기 처리 + 메시지 큐

**아키텍처 변경**:
```
Spring Boot Backend
     ↓ (노트 저장)
PostgreSQL
     ↓ (메시지 발행)
RabbitMQ (비동기 큐)
     ↓ (메시지 수신)
Knowledge Graph Service (FastAPI)
     ├─ Embedding Worker (임베딩 생성)
     ├─ Similarity Worker (유사도 계산)
     └─ Neo4j (저장)
```

**변화점**:
- 임베딩 작업 비동기화 (응답 시간 단축)
- 메시지 기반 통신 (느슨한 결합)
- 워커 분리 (확장성 향상)
- 재시도 로직 추가 (안정성)

---

## 🔍 주요 파일 설명

| 파일 | 목적 | 라인 수 |
|------|------|--------|
| `main.py` | FastAPI 앱 | ~80 |
| `app/db/neo4j_client.py` | Neo4j 연결 | ~50 |
| `app/crud/note.py` | CRUD 작업 | ~250 |
| `app/services/embedding_service.py` | 임베딩 생성 | ~100 |
| `app/services/similarity_service.py` | 유사도 연결 | ~150 |
| `app/api/v1/endpoints/notes.py` | 노트 API | ~200 |
| `Dockerfile` | 컨테이너 이미지 | ~30 |
| `pyproject.toml` | 의존성 정의 | ~40 |

---

## ✅ 완료 체크리스트

### Phase 1-4 완료 ✅

- ✅ Neo4j 설정
- ✅ CRUD 구현 (9개 테스트)
- ✅ 임베딩 서비스 (OpenAI API)
- ✅ 유사도 연결 (6개 테스트)
- ✅ REST API (FastAPI)
- ✅ API 통합 테스트 (10개)
- ✅ Docker 배포
- ✅ uv 패키지 관리
- ✅ 환경별 로깅
- ✅ 문서화 (README.md)

### Phase 5 대기 🔜

- 🔜 RabbitMQ 설정
- 🔜 비동기 워커 구현
- 🔜 메시지 기반 통신
- 🔜 Spring Boot 통합

---

## 📞 빠른 참고

### 서버 실행

```
# 로컬
uv run python main.py

# Docker
docker-compose up -d
```

### 문서 접속

- Swagger: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 테스트 실행

```
uv run pytest tests/ -v
docker-compose exec fastapi pytest tests/ -v
```

### 일반적인 문제 해결

**Docker에서 Neo4j 연결 안 됨**:
- .env 수정: `NEO4J_URI=bolt://host.docker.internal:7687`

**패키지 충돌**:
- `uv sync --force` 실행

**테스트 실패**:
- `uv run pytest tests/ -x -v` (첫 실패에서 중단)

---
