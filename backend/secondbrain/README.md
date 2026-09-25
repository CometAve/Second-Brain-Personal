# Second Brain 백엔드

Spring Boot REST API, JWT/OAuth 로그인, PostgreSQL 노트 저장, Redis 초안, Elasticsearch 검색, RabbitMQ 이벤트 및 Neo4j 검색을 담당합니다. 백엔드의 의존성·SDK·Gradle·테스트와 실행 설정은 `codex/local-compose` 작업트리에 함께 있습니다. 전체 로컬 실행 방법은 저장소 루트 README를 참고합니다.

## 실행 환경과 선택한 버전

2026-09-24 공식 배포 메타데이터와 실제 빌드·통합 테스트로 확인했습니다. prerelease, RC, milestone, snapshot은 선택하지 않았습니다.

| 항목 | 적용 버전 | 선택 근거 |
| --- | --- | --- |
| Java | Eclipse Temurin **26.0.2.1+1** | Gradle/Boot가 공식 지원하는 가장 최신 Java 계열의 안정 패치 |
| Gradle wrapper | **9.7.1** | 최신 stable, wrapper JAR·Unix/Windows 실행 스크립트도 갱신 |
| Spring Boot | **4.1.1** | 최신 stable, Spring Framework·Data·Security·AMQP는 해당 BOM 사용 |
| dependency-management plugin | **1.1.7** | 이미 최신 stable |
| Spring Cloud AWS | **4.1.1** | S3 자동 설정 및 실제 HTTP 요청을 로컬 stub으로 검증 |
| AWS SDK BOM | **2.55.4** | AWSpring 기본 2.54.3 대신 모든 SDK 모듈을 최신으로 정렬 |
| springdoc | **3.1.1** | Boot 4 지원, 실제 OpenAPI 응답 검증 |
| OpenAI Java | **4.69.0** | 최신 stable, embedding 요청·응답을 로컬 stub으로 검증 |
| Google API client | **2.9.1** | 공용 웹 Google ID token verifier 유지 |
| JJWT | **0.13.0** | API·impl·Jackson 모듈 동일 버전, 서명·파싱 검증 |
| spring-dotenv | **5.1.0** | 최신 stable |
| Elasticsearch Java / Rest5 client | **9.5.4** | 서버와 같은 버전, Boot 기본 9.4.5에서 명시적으로 갱신 |
| Neo4j Java driver | **6.3.0** | Boot 기본 6.1.0에서 갱신, Neo4j 2026.09 연결 검증 |
| Lombok | **1.18.48** | Boot 기본 1.18.46에서 갱신 |
| Jackson 3 BOM | **3.2.3** | 애플리케이션 HTTP·Redis·Rabbit 직렬화 |
| Jackson 2 BOM | **2.22.3** | OpenAI/JJWT/Swagger 등 내부 의존성이 사용하는 모듈 정렬 |
| Hibernate ORM / Validator | **7.4.10.Final / 9.1.4.Final** | 같은 안정 계열의 최신 패치, JPA 및 입력 검증 유지 |
| Netty BOM | **4.2.18.Final** | 모든 Netty 모듈과 macOS DNS native 모듈을 함께 정렬 |
| RabbitMQ Java client | **5.36.0** | 최신 안정 클라이언트, 로컬 broker 연결·선언 확인 |
| Lettuce / HikariCP | **7.7.0.RELEASE / 7.1.0** | Redis 8.10 대응 드라이버와 최신 JDBC pool |
| Tomcat / Logback | **11.0.26 / 1.6.3** | 최신 웹 서버·로깅 계열, 실제 HTTP 기동 검증 |
| JUnit / Mockito | **6.1.3 / 5.24.0** | 테스트 BOM·모듈 정렬, 기존 테스트 수와 검증 유지 |
| Docker 기반 | **Ubuntu 26.04**, Dockerfile frontend **1 stable** | ARM64/AMD64 공식 manifest 확인 |

Java 27 자체는 정식 출시됐지만, 현재 Gradle 9.7.1은 JVM 17~26, Boot 4.1.1은 Java 26까지만 지원합니다. 따라서 27은 적용하지 않았습니다. 코드 수정량을 이유로 이전 버전을 선택한 항목은 없습니다.

AWSpring의 공식 호환표는 Boot 4.0.x를 명시하므로 Boot 4.1 지원을 문서만으로 단정하지 않았습니다. 이 프로젝트에서 AWSpring 4.1.1 + Boot 4.1.1 + AWS SDK 2.55.4의 S3 자동 설정·업로드·삭제 및 전체 애플리케이션 기동을 검증한 뒤 유지했습니다. 실제 AWS 계정 권한과 버킷 정책을 검증했다는 의미는 아닙니다.

### Boot BOM과 개별 안정 버전 비교

직접 선언한 라이브러리뿐 아니라 사용 중인 starter의 핵심 런타임·테스트 프레임워크를 공식 Maven 메타데이터와 비교했습니다. 아래의 `유지`는 최신 안정판과 이미 같다는 의미입니다. BOM이 관리한다는 이유만으로 최신 후보를 검토하지 않거나 호환 불가로 판단하지 않았습니다.

| 사용 계층 | Boot 4.1.1 기본 | 확인한 최신 안정 / 적용 | 결정 |
| --- | --- | --- | --- |
| PostgreSQL JDBC | 42.7.13 | 42.7.13 | 유지, PostgreSQL 18.6 실제 쿼리 검증 |
| Spring Framework | 7.0.9 | 7.0.9 | 유지; 7.1.0-M2 제외 |
| Spring Data BOM | 2026.0.1 | 2026.0.1 | 유지; JPA·Redis 4.1.1, Elasticsearch 6.1.1, Neo4j 8.1.1 |
| Spring Security / AMQP | 7.1.1 / 4.1.1 | 7.1.1 / 4.1.1 | 유지; 다음 계열 milestone 제외 |
| Reactor BOM / Micrometer | 2025.0.7 / 1.17.1 | 2025.0.7 / 1.17.1 | 유지 |
| Hibernate ORM | 7.4.5.Final | 7.4.10.Final | override; 8.0.0.Beta2 제외, 공식 7.4 호환표는 Boot 4.1·Java 26 명시 |
| Hibernate Validator | 9.1.3.Final | 9.1.4.Final | override |
| Netty | 4.2.17.Final | 4.2.18.Final | BOM 전체 override; 같은 4.2 계열의 수정 릴리스 |
| RabbitMQ Java client | 5.30.0 | 5.36.0 | override; Spring AMQP와 실제 broker 연결 검증 |
| Lettuce | 7.5.2.RELEASE | 7.7.0.RELEASE | override; 공식 Redis 8.10 지원 및 로컬 Redis 데이터 왕복 검증 |
| HikariCP | 7.0.2 | 7.1.0 | override; 실제 PostgreSQL pool·쿼리 검증 |
| Tomcat | 11.0.24 | 11.0.26 | override; Servlet 6.1 계열 유지 |
| Logback | 1.5.38 | 1.6.3 | core/classic 함께 override; 공식 1.5 대체 계열, 프로젝트에 Janino 조건 설정 없음 |
| JUnit / Mockito | 6.0.3 / 5.23.0 | 6.1.3 / 5.24.0 | override; 전체 테스트 재실행 |

여러 모듈이 한 제품을 구성하는 경우 개별 JAR을 섞지 않고 Boot의 버전 속성 또는 제품 BOM으로 맞춥니다. 위 항목과 앞 표에 없는 내부 구현용 전이 라이브러리까지 모두 독립적인 최고 버전으로 강제한 것은 아닙니다. 이 문서는 그런 전이 패키지가 최신이거나 호환 불가라고 주장하지 않습니다.

## 주요 이전 사항

- Jackson 3의 `JsonMapper`와 Redis/Rabbit 변환기로 이전했습니다. HTTP 응답과 초안의 ISO-8601 날짜, 인증 코드의 기존 `@class` 데이터, Python worker의 snake_case 이벤트 계약을 유지합니다. Redis 타입 복원은 실제 사용하는 DTO·숫자·컬렉션으로 제한합니다.
- Boot의 기본 HTTP 변환기가 공용 `JsonMapper`를 사용하도록 했습니다. 변환기를 배열의 고정 위치에 추가하던 `WebConfig`는 제거했습니다.
- `RestTemplateBuilder` 패키지와 Boot 4의 REST client/MVC/security OAuth starter 구성을 반영했습니다.
- Elasticsearch Rest5를 사용하며, 이전 HTTP4 클래스와 모든 인증서를 신뢰하던 개발용 TLS 설정을 제거했습니다. 로컬 ES는 HTTP, 명시적으로 TLS를 사용하는 연결은 JVM trust store를 따릅니다.
- OpenAI embedding DTO의 패키지 이동과 `List<Float>` 응답을 반영했습니다. 애플리케이션의 `List<Double>` 계약, `text-embedding-3-small` 모델과 실제 1536차원 설정은 유지했습니다.
- OpenAI SDK가 가져오던 구 `swagger-annotations`를 제외하고 springdoc의 Jakarta annotations로 통일했습니다. 두 라이브러리가 같은 클래스를 제공하여 실제 `/v3/api-docs` 요청에서 발생한 `Schema.$dynamicRef()` 오류를 해결합니다.
- 실제 의존성이 없던 `springAiVersion` 및 `spring.ai.*` 설정을 제거했습니다. 사용 중인 OpenAI SDK와 `gms.*` 설정은 유지합니다.
- 로컬 CORS 기본값은 기존 확장 프로그램의 content script 요청을 위해 `*` 패턴입니다. `CORS_ALLOWED_ORIGIN`으로 허용 패턴을 명시할 수 있습니다.

## 빌드와 테스트

Draft 저장과 DB 승격은 draft ID별 Redis 잠금으로 순서를 맞춥니다. 승격 시 PostgreSQL의
`draft_promotions` 테이블에 draft ID, 소유자 ID, 생성된 note ID를 노트와 같은 트랜잭션으로
기록합니다. 이 기록은 노트 삭제 후에도 남아 같은 draft ID가 다시 노트를 만들지 못하게 합니다.
Redis의 처리 상태는 임시 조정 정보이며, 재시도 시 DB 기록을 먼저 확인합니다. 기존 HTTP
경로와 응답 형식은 그대로 유지합니다. 로컬 `ddl-auto: update` 설정은 새 테이블을 생성하며,
이를 사용하지 않는 환경에서는 배포 전에 같은 스키마를 준비해야 합니다.

명시적 초안 삭제는 기존 초안 TTL과 같은 24시간 삭제 기록을 남겨 늦은 version 1 저장을
차단합니다. 처리 중 프로세스가 종료된 경우 영구 저장 재시도가 상태를 복구하며, 스케줄러도
오래된 초안을 다시 처리합니다. 재시도 전에는 저장이 충돌할 수 있습니다. 노트와 승격 기록의
원자성은 PostgreSQL 트랜잭션 범위이며, 기존 Elasticsearch/RabbitMQ 발행의 원자적 전달은
보장하지 않습니다.

Java 26을 `JAVA_HOME`으로 지정한 뒤 이 디렉터리에서 실행합니다. 전역 Gradle 설치는 필요하지 않습니다.

```sh
./gradlew test bootJar
```

`test`는 외부 데이터 서비스 없이 실행합니다. `integrationTest`는 루트 Compose의 PostgreSQL·Redis·Elasticsearch·Neo4j·RabbitMQ가 먼저 준비되어야 합니다.

```sh
./gradlew integrationTest
./gradlew dependencies --configuration runtimeClasspath
```

`application-local.yml`은 IDE 실행에 맞춰 데이터 서비스 주소를 `localhost`로 제공합니다. Compose는 컨테이너 서비스 DNS로 덮어씁니다. 비밀번호와 RabbitMQ vhost 기본값은 `infra/local/.env.example`과 동일합니다. 개인 자격증명을 넣기 전 AI·S3·TTS 호출은 loopback 비활성 주소로 향합니다.

테스트는 개발자의 `.env`를 자동으로 읽지 않도록 빈 `build/test-work`에서 실행합니다. 테스트의 Google/AWS/AI 값은 합성 값이며 실제 외부 API는 호출하지 않습니다.

2026-09-24 검증 결과:

- Java 26.0.2.1+1 / Gradle 9.7.1에서 `compileJava`, `compileTestJava`, `bootJar` 성공.
- 기본 테스트 **67개 성공**, 실패·오류·skip **0개**. 기존 서비스 테스트 59개와 신규 직렬화·JWT·MockMvc·S3/OpenAI 로컬 HTTP 테스트 8개를 포함합니다.
- 통합 테스트 **2개 성공**, 실패·오류·skip **0개**. PostgreSQL 18.6 쿼리, Redis 8.10.2 임시 키 저장·조회·정리, ES 9.5.4 인덱스, Neo4j 2026.09.0 쿼리, RabbitMQ 4.3.6 exchange/queue 조회, 실제 `/health` 및 `/v3/api-docs` HTTP 200을 확인했습니다.
- 기존 노트 테스트의 누락된 이벤트 producer mock을 추가했습니다. DTO에 연결되지 않은 multipart fixture 대신 현행 JSON API에 맞춰 이미지 URL을 포함한 본문 보존을 검증합니다.
- 실제 외부 Google 로그인, 유료 LLM, AWS S3, Clova 요청은 검증 범위에 포함하지 않습니다. 컨테이너 전체 실행 검증은 루트 로컬 환경 문서의 기록을 참고합니다.

## 재현성과 체크섬

공식 `eclipse-temurin:26.0.2.1_1-jdk-jammy` 이미지는 조회 시 존재하지 않아, Dockerfile에서 공식 Temurin 배포본을 SHA256으로 검증해 사용합니다. 빌드와 실행 단계 모두 동일한 Java 26.0.2.1+1을 사용하며 JDK는 전역 시스템에 설치하지 않습니다.

| 배포물 | SHA256 |
| --- | --- |
| Gradle 9.7.1 bin ZIP | `acd53f1edaf02f1a8ff99879f8a34b302661a057d9b063ae9e35b552f804d20a` |
| Gradle 9.7.1 wrapper JAR | `7a9ce74cff467ca1bf60a4fcd9f05185acceda4d0f382434d393e17864262c5d` |
| Temurin 26.0.2.1+1 Linux ARM64 JDK | `9f6ad9856a7dd880061adaf88db3c4da0642113d59b7960a892f0e551c0c948c` |
| Temurin 26.0.2.1+1 Linux AMD64 JDK | `451c12e68747bcfa2fb5a2c16b00483fedb9fa6d77bc962d30957f76ac17044d` |

## 공식 확인 자료

- [Spring Boot 요구사항](https://docs.spring.io/spring-boot/system-requirements.html), [Boot 4 이전 안내](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
- [Gradle 안정 배포 및 체크섬](https://services.gradle.org/versions/current), [Java 호환표](https://docs.gradle.org/current/userguide/compatibility.html)
- [Temurin 26.0.2.1+1 공식 배포](https://github.com/adoptium/temurin26-binaries/releases/tag/jdk-26.0.2.1%2B1)
- [AWSpring 호환표](https://github.com/awspring/spring-cloud-aws/tree/v4.1.1#compatibility-with-spring-project-versions), [AWS SDK 메타데이터](https://repo.maven.apache.org/maven2/software/amazon/awssdk/bom/maven-metadata.xml)
- [springdoc](https://springdoc.org/), [OpenAI Java 메타데이터](https://repo.maven.apache.org/maven2/com/openai/openai-java/maven-metadata.xml), [JJWT](https://github.com/jwtk/jjwt/releases)
- [Google API 메타데이터](https://repo.maven.apache.org/maven2/com/google/api-client/google-api-client/maven-metadata.xml), [spring-dotenv 메타데이터](https://repo.maven.apache.org/maven2/me/paulschwarz/spring-dotenv/maven-metadata.xml)
- [Spring Data ES 이전 안내](https://docs.spring.io/spring-data/elasticsearch/reference/migration-guides/migration-guide-5.5-6.0.html), [Neo4j driver 호환표](https://neo4j.com/docs/java-manual/current/install/)
- [Boot 4.1.1 관리 버전 원본](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.1/spring-boot-dependencies-4.1.1.pom), [PostgreSQL JDBC](https://repo.maven.apache.org/maven2/org/postgresql/postgresql/maven-metadata.xml), [Spring Data BOM](https://repo.maven.apache.org/maven2/org/springframework/data/spring-data-bom/maven-metadata.xml)
- [Spring Framework](https://repo.maven.apache.org/maven2/org/springframework/spring-framework-bom/maven-metadata.xml), [Spring Security](https://repo.maven.apache.org/maven2/org/springframework/security/spring-security-bom/maven-metadata.xml), [Spring AMQP](https://repo.maven.apache.org/maven2/org/springframework/amqp/spring-amqp/maven-metadata.xml), [Reactor](https://repo.maven.apache.org/maven2/io/projectreactor/reactor-bom/maven-metadata.xml), [Micrometer](https://repo.maven.apache.org/maven2/io/micrometer/micrometer-bom/maven-metadata.xml)
- [Hibernate ORM 7.4 호환표](https://hibernate.org/orm/releases/7.4/), [Hibernate Validator 9.1](https://hibernate.org/validator/releases/9.1/), [Netty 4.2.18](https://netty.io/news/2026/09/09/4-2-18-Final.html)
- [RabbitMQ Java 5.36](https://github.com/rabbitmq/rabbitmq-java-client/releases/tag/v5.36.0), [Lettuce 7.7](https://github.com/redis/lettuce/releases/tag/7.7.0.RELEASE), [HikariCP](https://repo.maven.apache.org/maven2/com/zaxxer/HikariCP/maven-metadata.xml)
- [Tomcat 11 변경 기록](https://tomcat.apache.org/tomcat-11.0-doc/changelog.html), [Logback 1.6 이전 및 요구사항](https://logback.qos.ch/news.html), [JUnit 6.1.3](https://docs.junit.org/6.1.3/overview.html), [Mockito 5.24](https://github.com/mockito/mockito/releases/tag/v5.24.0)
- [Jackson 3 BOM](https://repo.maven.apache.org/maven2/tools/jackson/jackson-bom/maven-metadata.xml), [Jackson 2 BOM](https://repo.maven.apache.org/maven2/com/fasterxml/jackson/jackson-bom/maven-metadata.xml), [Redis Jackson 3 이전 안내](https://docs.spring.io/spring-data/redis/reference/upgrading.html)
- [공식 Docker 이미지 정의](https://github.com/docker-library/official-images/tree/master/library), [Dockerfile stable frontend](https://docs.docker.com/build/buildkit/frontend/)
