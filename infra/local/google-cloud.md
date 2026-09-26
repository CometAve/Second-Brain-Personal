# Google Cloud Gemini 연결

Google Cloud 프로젝트의 결제·무료 체험 크레딧을 사용하는 구성이다. AI Studio API 키 대신 사용자 ADC로 인증한다. [인증 준비 #15](https://github.com/CometAve/Second-Brain-Personal/issues/15), [앱 전환 #16](https://github.com/CometAve/Second-Brain-Personal/issues/16).

## 사용하는 모델과 설정

| 용도 | 모델 |
| --- | --- |
| 노트 요약, 리마인더 질문 | `gemini-3.8-flash`, thinking `LOW` |
| AI 검색의 분류·관련성 판단·답변 | `gemini-3.7-flash`, thinking `LOW` |
| 노트와 검색어 임베딩 | `gemini-embedding-2`, 1536차원 |
| 프로젝트·위치 | `reliable-sight-509720-b3`, `global` |

문서 입력은 `title: {title} | text: {content}`, 검색어 입력은 `task: search result | query: {query}`로 통일한다. Embedding 2에는 이전 모델의 `task_type`을 보내지 않는다. Neo4j에 `google-cloud/gemini-embedding-2/1536/prefix-v1` 태그를 저장하고 검색할 때도 같은 태그로 필터링한다. 모델을 바꾸면 차원이 같아도 기존 벡터를 그대로 사용할 수 없다.

Python은 `google-genai==2.25.0`과 `langchain-google-genai==4.4.0`, Java는 Google 인증 라이브러리와 REST를 사용한다. LangChain의 기본 `candidate_count`는 Gemini 3.8에서 허용되지 않아 좁은 어댑터에서 제외한다. SDK를 올릴 때 해당 요청 호환성 테스트를 유지한다. 검색 생성 응답은 `AIMessage.text`로 텍스트 블록만 추출한다. 검색 분류·임베딩·DB 조회·관련성 판단이 실패하면 기존 HTTP 500 응답으로 전달하고 정상적인 검색 결과 없음과 구분한다.

## 인증

Second Brain 전용 ADC는 `~/.config/gcloud-secondbrain/application_default_credentials.json`에 보관한다(권한 `0600`). 다른 프로젝트가 사용하는 기본 `~/.config/gcloud`는 변경하지 않는다. 다시 로그인해야 할 때:

```sh
CLOUDSDK_CONFIG="$HOME/.config/gcloud-secondbrain" \
  gcloud auth application-default login \
  --project=reliable-sight-509720-b3 \
  --scopes=openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform
```

Google Cloud 접근에 동의한다. 화면에 체크박스 없이 권한 설명과 `계속`만 표시될 수도 있다. 서비스 계정 키나 별도의 API 키는 필요하지 않다.

Git에서 제외되는 `infra/local/google-cloud.env`를 다음 형태로 준비한다. ADC 경로는 이 PC의 실제 절대 경로를 사용한다. 토큰·JSON 내용은 넣지 않는다.

```dotenv
GOOGLE_CLOUD_PROJECT=reliable-sight-509720-b3
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/gcloud-secondbrain/application_default_credentials.json
GEMINI_EMBEDDING_MODEL=gemini-embedding-2
GEMINI_GENERATION_MODEL=gemini-3.8-flash
SUMMARIZE_MODEL=gemini-3.8-flash
SEARCH_AGENT_MODEL=gemini-3.7-flash
RABBITMQ_QUEUE=note_creation_queue_gemini
```

## 실행

아래 두 env 파일과 두 Compose 파일을 함께 사용해야 한다. 기존 데이터가 있다면 먼저 다음 절의 큐 전환을 마쳐야 한다.

```sh
COMPOSE_PARALLEL_LIMIT=1 docker compose \
  --env-file infra/local/.env --env-file infra/local/google-cloud.env \
  -f compose.yaml -f compose.google-cloud.yaml \
  --profile full up -d --build --wait
```

ADC 파일은 백엔드·AI API·워커에서 `/run/secrets/google-adc.json`에 읽기 전용으로 연결한다. 이미지에 복사하지 않으며, 호스트 파일이 없으면 Compose가 디렉터리를 대신 만들지 않고 실패한다. 서비스마다 같은 프로젝트·모델·큐를 사용한다.

호스트 인증만 재확인하려면 다음을 실행한다. 짧은 합성 문장으로 실제 모델 API를 호출하며 사용량이 발생한다.

```sh
python3 infra/local/check_google_cloud.py \
  --project reliable-sight-509720-b3 \
  --gcloud-config "$HOME/.config/gcloud-secondbrain"
```

실패한 모델만 확인하려면 `--only generation` 또는 `--only embedding`을 붙인다. 도구는 토큰이나 전체 벡터를 출력하지 않는다. `global` 엔드포인트에서 검증했으며 `us` multi-region은 준비 당시 503을 반환했다.

## 기존 큐와 노트 전환

기존 이벤트에는 노트 버전이 없다. 오래된 생성·수정·삭제 이벤트를 지금 그대로 소비하면 삭제한 노트가 그래프에 나타나거나 최신 상태가 과거 상태로 바뀔 수 있다. 큐를 비우거나 원본 노트를 삭제하는 방식으로 전환하지 않는다.

1. 백엔드·AI API·워커 등 발행자를 멈춘 뒤 PostgreSQL과 RabbitMQ 데이터를 백업한다.
2. PostgreSQL의 현재 노트 ID·사용자·제목·본문·버전을 스냅샷으로 보관한다. 기존 Neo4j 벡터가 있으면 모델 교체와 재생성 범위를 먼저 확인한다.
3. 새 durable 큐를 만들고 현재 노트만 `note.created`로 넣는다. persistent 메시지, publisher confirm, mandatory 발행을 사용하고 메시지 수와 고유 ID를 확인한다.
4. 기존 큐의 `knowledge_graph_events` / `note.*` 바인딩을 해제한다. 기존 메시지는 삭제하지 않는다.
5. 백엔드·AI API·워커 모두 새 큐 설정으로 시작한다. 새 큐가 처리되고 기존 큐의 소비자와 이벤트 바인딩이 0인지 확인한다.
6. 원본 노트 수·ID, 그래프의 모델 태그·차원, 새 노트 생성·수정·삭제·검색을 확인한다.

이번 PC 전환은 원본 노트 12개, 기존 그래프 노드 0개를 기준으로 시작했다. 기존 큐 메시지 97건을 보관하고 현재 노트 12개만 새 큐로 발행해 모두 처리했다. 원본 생성·수정 시각도 PostgreSQL과 대조해 복원했다. 이 PC의 백엔드 JVM과 PostgreSQL은 UTC이며 기존 Docker 시간대 설정도 변경되지 않았다. 시간대 없는 원본 값을 이 로컬 UTC 기준으로 해석했으며, 12개의 시각 일치와 원래 UTC 날짜 검색을 확인했다. 다른 환경에서 가져온 시간대 없는 데이터에는 이 해석을 그대로 적용하면 안 된다. 백업과 스냅샷은 Git 바깥 `~/.local/state/secondbrain/gemini-migration-20260926/`에 보관한다. 이 디렉터리에는 개인 데이터와 RabbitMQ 자격 정보가 있으므로 공유하지 않는다.

RabbitMQ가 384 MiB 한도에서 OOM으로 종료된 기록이 있어 512 MiB로 조정하고 Erlang scheduler를 제한했다. 기존 볼륨의 노드 식별자는 `rabbit@9b8d6822d531`이므로 이 PC의 `.env`는 `RABBITMQ_HOSTNAME=9b8d6822d531`을 유지한다. 재생성 중 hostname이 달라져 큐가 일시적으로 보이지 않았으나 데이터를 백업하고 원래 식별자로 복원했다. 새 설치만 기본값 `rabbitmq`를 사용한다.

## 남아 있는 저장 구조의 한계

Gemini 설정으로 다음 저장 정책이나 트랜잭션 구조까지 바뀌지는 않는다.

- **삭제 보호 24시간:** 삭제한 초안이 늦게 도착한 저장 요청으로 되살아나지 않게 하는 표식이 24시간 뒤 만료된다. 영구적인 삭제 이력은 아니다.
- **처리 중 종료:** 서버가 저장 도중 종료되면 “처리 중” 표시와 실제 DB 상태가 어긋날 수 있다. 재시작만으로 모든 중간 작업을 자동 복구하는 구조는 아니다.
- **DB와 외부 이벤트의 일관성:** DB 저장과 RabbitMQ 발행은 하나의 원자적인 작업이 아니다. 예를 들어 DB에는 저장됐지만 메시지 발행이 실패하면 그래프 갱신이 빠질 수 있다. 반대 순서의 실패도 가능하다. 트랜잭셔널 outbox 같은 별도 설계가 필요하다.

워커는 모델·Neo4j 처리 실패 시 메시지를 확인 처리(ACK)하지 않고 큐로 돌려보낸 뒤 오류로 종료한다. 자동 재시작은 하지 않는다. 원인을 고친 뒤 워커를 다시 켜야 하며, 이 처리는 외부 이벤트의 원자성이나 버전 순서를 보장하지 않는다. 생성·관계 저장의 MERGE는 단순 재시도의 중복 생성을 줄이지만 이후 수정까지 포함한 임의의 과거 이벤트 재생을 안전하게 만들지는 않는다.

## 검증 범위

2026-09-26 별도 `codex/gemini-cloud` 워크트리에서 확인한 결과다. 프론트엔드 파일은 변경하지 않았다. 커밋·PR·병합 상태와 같은 완료 범위는 [이슈 #16](https://github.com/CometAve/Second-Brain-Personal/issues/16)에서 확인한다.

- Java `test bootJar`: 79개 테스트 통과. 실제 시작 검사에서 발견한 WebClient 등록 누락 수정 및 회귀 테스트 포함.
- Python `tests/test_gemini_migration.py`: 25개 오프라인 테스트 통과. 잠금 파일 검사·compileall·diff 검사 통과. 기존 외부 서비스 의존 수동 테스트 전체를 실행한 것은 아니다.
- 실제 Cloud 호출: 문서·검색어 임베딩 각 1536차원, 요약 스키마, Java 생성 호출 통과.
- 실제 로컬 API와 별도 합성 사용자: 생성→임베딩·관계 생성→Java 하이브리드 검색→수정 시 벡터 교체→요약 결과 저장→삭제 후 PostgreSQL·Neo4j 제거 통과. Java 로그에서 Elastic 1건·Vector 2건의 실제 병합 확인.
- 워커 실패: 별도 테스트 큐의 잘못된 이벤트가 NACK 뒤 재전달 가능 상태로 남는 것 확인. 테스트 큐 제거.
- 기존 노트 12개 반영, 새 큐 대기 0건·소비자 1개, 기존 큐 97건·소비자/외부 이벤트 바인딩 0개 확인.
- 최종 AI 검색(3.7 Flash): 실제 API에서 테스트 노트 1개 검색, 일반 문자열 응답, 전체 13.57초 확인. 테스트 사용자·노트 삭제 후 원본 12개와 관계 9개만 남고, 원본 PostgreSQL 필드·버전이 스냅샷과 모두 같은 것을 확인했다.
- 모델 실패 주입은 HTTP 500으로 반환되어 성공한 빈 결과와 구분됐다.
- 브라우저 UI 조작은 이번 백엔드 전환 검증에 포함하지 않았다. 기존 웹의 시각적 개편 작업은 별도 워크트리에 남아 있다.

AI 검색의 3.8 Flash 호출은 관련성 판단에 85~159초, 전체 요청에 300초 초과가 관찰됐다. 출력 한도 512토큰도 60초 안에 응답하지 않아 지연 해결로 채택하지 않았다. 같은 앱 어댑터로 3.7 Flash 관련성 판단이 7.74초에 끝나는 것을 확인해 **검색에만 3.7 Flash를 적용**했다. 이는 관찰한 합성 사례의 결과이며 모든 요청의 응답 시간을 보장하지 않는다.

`health` 성공, 단위 테스트, 실제 모델 호출, 사용자 흐름 검증은 서로 다른 확인이다.

무료 체험 결제 연결과 잔액은 앞선 Cloud Console 확인에 근거하며 실제 호출의 크레딧 차감 내역은 확인하지 않았다. 사용에 불필요한 Cloud Billing API/Resource Manager API는 활성화하지 않았다. 결제 계정을 유료로 전환하지 않았다. 앞선 서비스 계정 API 키 정책 예외는 남아 있으나 현재 ADC 경로에서는 사용하지 않는다.

공식 참고: [ADC](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/gcp-auth), [Gemini 3.8 Flash](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash), [Embedding 2](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/embeddings/get-multimodal-embeddings), [AI Studio 결제](https://ai.google.dev/gemini-api/docs/billing).
