# Docker Desktop 로컬 개발

프론트엔드는 호스트에서 실행하고 데이터 서비스·백엔드·AI는 필요할 때만 컨테이너로 실행합니다. 저장소 루트의 `compose.yaml`을 기본 구성으로 사용하고, Google Cloud AI 호출은 `compose.google-cloud.yaml`을 추가합니다. 기존 `Deploy/`, 프론트 Dockerfile과 중복 개발 Compose는 제거했습니다.

## 통합한 실행 기준

백엔드의 Java 26·Gradle 9.7.1·Spring Boot 4.1.1 변경과 웹·확장·AI·MCP 의존성 최신화를 함께 사용합니다. Python 3.14.7 및 uv 잠금 파일도 저장소에 반영되어 있으며 각 앱의 README에서 버전 선택 근거를 확인할 수 있습니다.

## 준비

Docker Desktop을 실행하고 저장소 루트에서 다음을 실행합니다. 예제 비밀번호는 이 PC의 로컬 개발용이며, 공개 서버에 사용하는 구성은 아닙니다. 모든 공개 포트는 `127.0.0.1`에 바인딩됩니다.

```sh
cp infra/local/.env.example infra/local/.env
```

이미 존재하는 `.env`는 덮어쓰지 말고 필요한 항목만 추가합니다. `infra/local/.env`는 Git에서 제외됩니다. 실제 외부 서비스 키를 넣지 않아도 데이터 서비스와 앱의 health 확인이 가능하도록 구성했습니다. 이 상태에서는 Google 로그인·AI 생성·S3 업로드·Clova TTS를 사용할 수 없습니다. Gemini 사용에는 프로젝트와 ADC가 필요합니다. [Google Cloud 연결 및 기존 큐 전환](google-cloud.md)을 먼저 확인하세요. 별도 Cloud 파일을 명시적으로 적용해야 컨테이너가 인증 파일을 읽습니다.

## 필요한 프로필만 실행

| 프로필 | 실행 서비스 | 메모리 상한 합계 |
| --- | --- | --- |
| `data` | PostgreSQL, Redis, Elasticsearch, RabbitMQ, Neo4j | 2,432 MiB |
| `backend` | data + Spring 백엔드 | 3,200 MiB |
| `ai` | Neo4j, AI API | 1,280 MiB |
| `worker` | backend + AI 워커 | 3,712 MiB |
| `full` | 모든 데이터 서비스 + 백엔드 + AI API + 워커 | 4,224 MiB |

프로필을 지정하지 않은 일괄 실행은 서비스를 자동으로 켜지 않습니다. 특정 서비스만 지정하면 해당 서비스와 선언된 의존성만 실행됩니다.

```sh
# 로컬 Spring 실행에 필요한 데이터 서비스만
docker compose --env-file infra/local/.env --profile data up -d --build --wait

# 프론트 개발용 백엔드와 데이터 서비스
docker compose --env-file infra/local/.env --profile backend up -d --build --wait

# 그래프·AI API 개발용. 백엔드 연동 기능은 backend 프로필도 필요
docker compose --env-file infra/local/.env --profile ai up -d --build --wait

# Cloud 전체 연동: 인증과 기존 큐 전환 준비 후 사용
docker compose --env-file infra/local/.env --env-file infra/local/google-cloud.env \
  -f compose.yaml -f compose.google-cloud.yaml --profile full up -d --build --wait

# Redis만 필요할 때
docker compose --env-file infra/local/.env up -d redis

# 확인과 종료. down은 기본적으로 데이터 볼륨을 보존
docker compose --env-file infra/local/.env --profile full ps
docker compose --env-file infra/local/.env --profile full down
```

AI 워커는 노트 이벤트를 처리합니다. Cloud 인증 없이 워커를 켜서 대기 이벤트를 소비하지 마세요. Gemini 전환 시 과거 큐를 그대로 재생하지 않고 현재 노트를 기준으로 새 큐를 구성합니다. 실제 Google 로그인을 사용하려면 OAuth 클라이언트의 리디렉션 URI를 `http://localhost:8080/login/oauth2/code/google`로 등록합니다.

## 프론트엔드

웹 폴더의 `.env`에는 아래 주소를 사용합니다. 로그인 리디렉션의 기준 웹 주소는 `http://localhost:5173`입니다. 기존 확장 프로그램은 content script에서 현재 웹페이지 origin으로 API를 직접 호출하므로, 로컬 CORS는 기존 `allowedOriginPatterns=*` 동작을 유지합니다. 특정 사이트에서만 사용할 때는 `.env`의 `CORS_ALLOWED_ORIGIN`에 허용할 origin을 쉼표로 지정할 수 있습니다.

```dotenv
VITE_API_BASE_URL=http://localhost:8080
VITE_KG_API_BASE_URL=http://localhost:8000
VITE_OAUTH2_LOGIN_URL=http://localhost:8080/oauth2/authorization/google
```

```sh
cd frontend/secondbrain
pnpm install --frozen-lockfile
pnpm dev --host localhost --port 5173 --strictPort
```

Node/pnpm 버전은 웹의 `.nvmrc`와 `package.json`을 따릅니다. 프론트 Docker 빌드는 사용하지 않습니다.

## 자원 제한과 데이터

| 서비스 | CPU 상한 | 메모리 상한 | 내부 설정 |
| --- | --- | --- | --- |
| PostgreSQL | 0.5 | 256 MiB | 개인 개발용 단일 인스턴스 |
| Redis | 0.25 | 128 MiB | 데이터 메모리 80 MiB, noeviction |
| Elasticsearch | 1.0 | 768 MiB | JVM heap 384 MiB, 사용하지 않는 ES ML 기능 비활성화 |
| RabbitMQ | 0.5 | 512 MiB | 메모리 경보 192 MiB, Erlang scheduler 2개 |
| Neo4j | 1.0 | 768 MiB | heap 최대 384 MiB, page cache 128 MiB |
| 백엔드 | 1.0 | 768 MiB | JVM heap 컨테이너 메모리의 55% |
| AI API | 0.75 | 512 MiB | worker 1개, 자동 reload 없음 |
| AI 워커 | 0.5 | 512 MiB | 단일 소비자 프로세스 |

상한은 예약 메모리나 실제 사용량이 아닙니다. 확인한 PC는 8 GiB, Docker VM은 약 3.8 GiB여서 전체 프로필의 최대치와 VM 여유분을 동시에 충족하지 못할 수 있습니다. 평소에는 필요한 프로필만 실행하고, 빌드는 `COMPOSE_PARALLEL_LIMIT=1`로 순차 실행하는 편이 좋습니다. 전역 Docker Desktop 설정은 자동으로 변경하지 않습니다.

`RABBITMQ_HOSTNAME`은 RabbitMQ 볼륨의 노드 식별자입니다. 새 설치에서는 `rabbitmq`를 사용합니다. 기존 볼륨에서는 실행 중 컨테이너의 hostname 또는 볼륨 안의 `rabbit@<hostname>`을 확인해 같은 값을 유지하세요. 값을 바꾸면 기존 큐가 보이지 않는 새 노드로 시작될 수 있습니다.

재부팅 시 전부 자동 실행되지 않도록 `restart: "no"`를 사용합니다. 로그는 서비스당 5 MiB × 2개로 제한합니다. 데이터는 Compose 프로젝트 이름에 종속된 named volume에 저장하며 이전 운영 서버의 외부 볼륨·네트워크를 사용하지 않습니다. worktree 두 개를 동시에 실행하려면 `-p`로 프로젝트명을 구분하고 호스트 포트도 다르게 지정해야 합니다. Git worktree만으로 Docker 자원이 분리되지는 않습니다.

## 실행 기준과 제거한 플러그인

2026-09-24 최신 안정 후보를 클라이언트와 함께 적용했습니다. 아래 태그의 Apple Silicon용 Linux arm64 이미지를 실제로 내려받아 실행했습니다.

| 서비스 | 이미지/플러그인 버전 |
| --- | --- |
| PostgreSQL | `18.6-alpine` |
| Redis | `8.10.2-alpine` |
| Elasticsearch + analysis-nori | `9.5.4` (동일 버전) |
| RabbitMQ | `4.3.6-management-alpine` |
| Neo4j Community | `2026.09.0-community` |
| 백엔드 | Ubuntu `26.04`, Temurin `26.0.2.1+1`, Gradle `9.7.1` |
| AI API·워커 | Python `3.14.7-slim-trixie`, uv `0.12.18` |

PostgreSQL 18 이미지의 데이터 경로 변경에 맞춰 볼륨을 `/var/lib/postgresql`에 연결하고 논리 이름을 `postgres18-data`로 분리했습니다. 기존 PostgreSQL 17 볼륨을 그대로 연결하지 않습니다. 다른 메이저 버전에서 개인 데이터를 가져올 때도 백업·복원 또는 공식 업그레이드 절차가 필요합니다. 이번 검증은 새 합성 데이터 볼륨만 사용했습니다. [공식 PostgreSQL 이미지의 데이터 경로](https://hub.docker.com/_/postgres)

최신 Java 27은 Gradle·Spring의 지원 상한 때문에 적용하지 않았습니다. 지원 가능한 최신 패치를 적용한 근거와 공식 바이너리 검증 방법은 [백엔드 README](../../backend/secondbrain/README.md)에 있습니다.

Elasticsearch는 애플리케이션이 사용하는 공식 `analysis-nori`만 이미지 빌드 시 설치합니다. 사용되지 않는 EricKor 플러그인(기존 배포 파일은 Elasticsearch 8.7.1 전용)은 제거했습니다. RabbitMQ 코드가 표준 topic exchange만 사용하므로 외부 delayed-message 이미지 대신 공식 이미지를 사용합니다. Neo4j 코드가 사용하는 Cypher·벡터 인덱스는 기본 기능이므로 APOC 플러그인과 운영 TLS 마운트는 포함하지 않습니다.

## 검증

2026-09-24 master 통합 후 `data`·`backend`·`ai`·`worker`·`full` 프로필의 Compose 구성을 다시 해석했습니다. 서비스 수 5·6·2·7·8개, 문서의 메모리 상한 합계, 모든 서비스의 CPU·메모리 제한 및 공개 포트의 loopback 바인딩을 확인했습니다. 이는 설정 검증이며 이번 통합 과정에서 전체 컨테이너를 다시 기동한 결과는 아닙니다. 백엔드 코드·테스트·빌드 설정은 아래 기존 검증 시점과 바이트 단위로 같음을 확인했습니다.

Compose 전체/프로필별 설정, CPU/메모리 상한, 이미지 arm64 지원을 확인합니다. 별도 `secondbrain-upgrade-qa` 프로젝트와 새 볼륨으로 서비스 health 및 연결을 검사하며, 실제 OAuth·유료 LLM·S3·TTS 요청은 하지 않습니다. 아래는 두 작업을 분리하기 전에 최신 의존성과 로컬 구성을 함께 적용해 수행한 실행 검증 기록입니다. 아래 전체 스택 기록은 분리 후 재실행 결과와 구분합니다.

- Compose 구성 검증: 통과
- 실행 이미지 Linux arm64 지원: 통과
- 백엔드·AI API·워커 및 Nori 이미지 빌드: 통과
- 전체 8개 서비스 기동: 통과. healthcheck가 있는 7개 healthy, 워커 running 및 실제 queue consumer 1개 확인
- PostgreSQL SELECT 1, Redis PING, Nori 한국어 분석, AI→Neo4j RETURN 1: 통과
- 백엔드 `/health`, `/v3/api-docs`, AI `/ai/health` 및 `/ai/openapi.json`: 통과. 모바일 컨트롤러를 제거한 통합 상태의 기록이며, 이번 변경에도 해당 제거를 포함함
- 웹 `localhost:5173` 및 확장 content script를 나타내는 합성 origin `https://example.org`의 CORS preflight: 통과. 외부 사이트에 접속하지 않고 로컬 서버의 응답 헤더만 검사
- AI 그래프 시각화·통계 API의 실제 Neo4j 조회 및 합성 1536차원 벡터 인덱스 생성·검색·삭제: 통과
- Docker inspect로 8개 서비스 CPU/메모리 상한 적용: 확인
- 최종 백엔드 이미지로 재기동 후 동일 검사 통과. 8개 서비스에서 OOM 및 자동 재시작 없음
- RabbitMQ는 양쪽 앱이 같은 `secondbrain` vhost를 사용. 기존 Python AMQP URL 생성기가 `/` vhost를 빈 문자열로 해석하는 문제를 실행 설정으로 피함
- 실제 OAuth·LLM·S3·TTS 요청 및 UI 검수: 범위에서 제외

`/health` 응답만으로 데이터 서비스 전체가 검증되는 것은 아닙니다. 위 별도 연결 검사 및 [백엔드 통합 테스트](../../backend/secondbrain/README.md)를 함께 수행했습니다. 워커는 큐 연결과 소비자 등록만 확인했으며, 실제 유료 모델을 사용하는 노트 처리 성공을 의미하지 않습니다.

검증 후 이번 작업에서 만든 QA 컨테이너·네트워크·합성 데이터 볼륨은 제거했습니다. 빌드 이미지·다운로드 캐시는 다음 로컬 실행에서 재사용할 수 있도록 남겼습니다. 사용자의 기존 데이터 볼륨을 삭제하거나 전역 Docker 리소스 설정을 바꾸지 않았습니다.

자원 상한은 개인 개발용 기동 검사 기준입니다. 대량 노트·임베딩 처리나 동시 요청의 부하 검증은 포함하지 않으므로 사용량에 따라 조정하세요. Elasticsearch는 ML 기능을 끄고 CPU 제한에 맞춰 processor 수를 1로 설정했습니다.

공식 참고: [Compose 프로필](https://docs.docker.com/compose/how-tos/profiles/), [서비스 자원 제한](https://docs.docker.com/reference/compose-file/services/), [Docker Desktop 리소스](https://docs.docker.com/desktop/settings-and-maintenance/settings/).
