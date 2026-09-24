# 의존성은 커밋된 uv.lock에서만 설치한다.
FROM python:3.14.7-slim-trixie AS builder

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.12.18 /uv /bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.14.7-slim-trixie AS runtime

WORKDIR /app
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl tzdata && \
    rm -rf /var/lib/apt/lists/*

ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    TZ=Asia/Seoul

COPY --from=builder /app/.venv /app/.venv
COPY app ./app
COPY main.py ./main.py

EXPOSE 8000

# 로컬 Compose에서도 단일 프로세스로 실행하고 자동 reload는 사용하지 않는다.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
