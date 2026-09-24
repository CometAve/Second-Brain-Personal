# Personal Notes MCP Server

Second Brain의 노트를 검색·생성하고 연결된 노트를 조회하는 stdio MCP 서버입니다.

| 도구 | 동작 |
|---|---|
| `search_personal_notes` | 자연어 또는 기간으로 노트 검색 |
| `note_create` | 제목과 Markdown 본문으로 노트 생성 |
| `graph_note_search` | 특정 노트와 연결된 주변 노트 조회 |

## 설치와 실행

Python **3.14.7**, uv **0.12.18**을 사용합니다. `.python-version`과 `pyproject.toml`의 uv 버전 검사가 실행 기준을 지정합니다.

```bash
cd agent-MCP
uv sync --locked
cp .env-example .env
```

백엔드에서 발급한 개인 API 키를 `.env`에 설정합니다. 예제 파일의 값은 실제 인증 키가 아닙니다.

```dotenv
API_KEY=your-api-key
API_BASE_URL=http://localhost:8080
AI_API_BASE_URL=http://localhost:8000
```

`API_BASE_URL`은 Spring 백엔드, `AI_API_BASE_URL`은 지식 그래프 서비스의 주소입니다. `/api`나 `/ai/api/v1` 접미사를 넣지 않습니다. 주소 끝의 `/`는 있어도 없어도 됩니다. 기존 단일 API 주소를 계속 쓰는 경우 `AI_API_BASE_URL`을 생략하면 `API_BASE_URL`을 함께 사용합니다.

실제 호출 경로는 다음과 같습니다. 로컬 서버 준비는 [루트 실행 안내](../infra/local/README.md)를 따릅니다.

| 용도 | 서비스와 경로 |
|---|---|
| 검색 | AI `POST /ai/api/v1/agents/mcp-search` |
| 그래프 탐색 | AI `GET /ai/api/v1/graph/neighbors/{note_id}` |
| API 키 검증 | 백엔드 `POST /api/apikey/validate` |
| 노트 생성 | 백엔드 `POST /api/mcp/notes` |
| 노트 상세 | 백엔드 `GET /api/mcp/notes/{note_id}` |

```bash
uv run --locked python main.py
# FastMCP CLI로 같은 서버를 실행할 때
uv run --locked fastmcp run fastmcp.json
```

`fastmcp.json`은 진입점과 stdio 설정만 관리합니다. 별도 무버전 `--with` 환경을 만들지 않고, 위 명령의 프로젝트 `uv.lock`으로 설치된 패키지를 사용합니다.

## MCP 클라이언트 연결

다음 명령은 현재 디렉터리의 절대 경로를 포함한 클라이언트 설정을 출력합니다. 파일을 자동 변경하지 않습니다.

```bash
uv run --locked python generate_config.py
```

출력된 `mcpServers` 항목을 사용하는 클라이언트의 설정에 추가합니다. 핵심 실행 형식은 다음과 같습니다.

```json
{
  "mcpServers": {
    "personal-notes": {
      "command": "uv",
      "args": [
        "--directory",
        "/absolute/path/to/Second-Brain-Personal/agent-MCP",
        "run",
        "--locked",
        "python",
        "main.py"
      ]
    }
  }
}
```

클라이언트가 uv를 찾지 못하면 `command`에 설치된 uv의 절대 경로를 지정합니다. 설정 후 클라이언트를 다시 실행하고 위 세 도구가 보이는지 확인합니다.

## 버전과 호환성

2026-09-24 기준 [Python 공식 릴리스](https://www.python.org/downloads/release/python-3147/)와 [PyPI FastMCP](https://pypi.org/project/fastmcp/4.0.8/)의 안정 버전을 확인했습니다.

| 직접 의존성 | 고정 버전 |
|---|---|
| FastMCP | 4.0.8 |
| HTTPX | 0.28.1 |
| Pydantic | 2.13.5 |
| python-dotenv | 1.2.3 |

FastMCP 4는 MCP Python SDK 2와 Pydantic 2.12 이상을 사용합니다. `uv.lock`에는 MCP 2.2.0, FastMCP Slim 4.0.8, HTTPX2 2.13.1, Starlette 1.7.0이 함께 고정됩니다. 기존 도구 내부의 HTTPX 요청은 SDK의 HTTPX2와 별개이므로 HTTPX 0.28.1을 직접 선언합니다. `dotenv`와 `pydantic`도 코드에서 직접 import하므로 직접 의존성에 포함했습니다. [FastMCP 2→3 이전](https://gofastmcp.com/getting-started/upgrading/from-fastmcp-2), [FastMCP 3→4 이전](https://gofastmcp.com/getting-started/upgrading/from-fastmcp-3)

현재 `FastMCP(name)`, `@mcp.tool`, `run(transport="stdio")` 사용은 최신 API에서도 동작합니다. 프로젝트 구성은 현재 `source` 형식을 사용합니다. [FastMCP 프로젝트 구성](https://gofastmcp.com/deployment/server-configuration)

## 검증

```bash
uv lock --check
uv sync --locked
uv run --locked python -m unittest discover -s tests -v
```

라우팅 테스트는 실제 `.env`를 읽지 않고 합성 키와 HTTPX `MockTransport`를 사용합니다. MCP 클라이언트에서 도구를 호출하여 AI 검색·그래프 요청과 백엔드 인증·노트 요청의 주소·헤더를 확인하고, 기존 단일 API 주소 설정도 검사합니다. 실제 API 키나 외부 API 호출은 필요하지 않습니다.

2026-09-24 master 통합 후에도 Python 3.14.7·FastMCP 4.0.8의 기존 잠금 의존성 가상환경에서 현재 작업 트리의 라우팅 테스트 3개를 다시 실행해 통과했습니다. 실패·오류·건너뜀 및 소켓 연결 시도는 없었습니다. 위 명령으로 현재 작업 트리의 라우팅을 다시 확인할 수 있습니다.

Python 3.14.7에서 Mac ARM·Linux ARM 의존성 해석 및 Mac의 별도 가상환경 설치를 확인했습니다. 별도 프로세스의 stdio 연결에서도 FastMCP 클라이언트의 `auto`·`legacy` 모드 각각 도구 목록과 외부 요청 없는 입력 검증 호출을 확인했습니다. 실제 사용자의 MCP 클라이언트 연결과 개인 데이터에 대한 검색 품질은 이 검사에 포함되지 않습니다.

## 알려진 기존 제약

- `graph_note_search`의 설명에는 `depth` 기본값이 1이라고 되어 있지만 현재 도구 입력 스키마에는 필수 항목으로 등록됩니다. 현재는 `depth`를 명시해야 합니다. 기본값 누락은 버전 변경과 별개인 기존 기능 결함으로 남겨 두었습니다.
- 루트 Compose의 합성 AI 키로는 서버 기동만 확인할 수 있습니다. 실제 검색·임베딩·노트 이벤트 처리는 유효한 모델 API 설정이 필요합니다.
- stdio 로그와 오류 메시지는 MCP 클라이언트의 서버 로그에서 확인합니다. 인증 오류는 백엔드 API 키와 서버 주소를 확인합니다.
