# syntax=docker/dockerfile:1

# Java 26.0.2.1 / Gradle 9.7.1을 사용합니다.
# 최신 Temurin 패치의 공식 이미지가 없어, 공식 배포본을 SHA256으로 고정합니다.
FROM ubuntu:26.04 AS java
ARG TARGETARCH
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl tzdata libfontconfig1 adduser && \
    rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    case "$TARGETARCH" in \
      arm64) JAVA_ARCH=aarch64; JAVA_SHA256=9f6ad9856a7dd880061adaf88db3c4da0642113d59b7960a892f0e551c0c948c ;; \
      amd64) JAVA_ARCH=x64; JAVA_SHA256=451c12e68747bcfa2fb5a2c16b00483fedb9fa6d77bc962d30957f76ac17044d ;; \
      *) echo "Unsupported Java architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl --fail --location --retry 3 \
      "https://github.com/adoptium/temurin26-binaries/releases/download/jdk-26.0.2.1%2B1/OpenJDK26U-jdk_${JAVA_ARCH}_linux_hotspot_26.0.2.1_1.tar.gz" \
      -o /tmp/jdk.tar.gz; \
    printf '%s  %s\n' "$JAVA_SHA256" /tmp/jdk.tar.gz | sha256sum --check -; \
    mkdir -p "$JAVA_HOME"; \
    tar --extract --gzip --file /tmp/jdk.tar.gz --directory "$JAVA_HOME" --strip-components=1; \
    rm /tmp/jdk.tar.gz; \
    java -version

FROM java AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && sed -i 's/\r$//' gradlew
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon --version

COPY src ./src
RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew --no-daemon --max-workers=2 \
    -Dorg.gradle.jvmargs="-Xmx384m -XX:MaxMetaspaceSize=256m" bootJar
RUN set -eu; \
    JAR_FILE="$(find build/libs -maxdepth 1 -name '*.jar' ! -name '*-plain.jar')"; \
    test -n "$JAR_FILE"; \
    cp "$JAR_FILE" /app/app.jar

FROM java AS runtime
WORKDIR /app
RUN addgroup --system spring && adduser --system --ingroup spring spring
COPY --from=build --chown=spring:spring /app/app.jar /app/app.jar
USER spring
EXPOSE 8080
# 768 MiB 컨테이너에서 metaspace/native buffer에도 메모리를 남깁니다.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=55.0 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
