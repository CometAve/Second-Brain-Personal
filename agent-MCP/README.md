# Personal Notes MCP Server

Second Brain의 노트를 검색·생성하고 연결된 노트를 조회하는 stdio MCP 서버입니다.

| 도구 | 동작 |
|---|---|
| `search_personal_notes` | 자연어 또는 기간으로 노트 검색 |
| `note_create` | 제목과 Markdown 본문으로 노트 생성 |
| `graph_note_search` | 특정 노트와 연결된 주변 노트 조회 |

이 작업 공간은 Python·FastMCP 의존성 최신화를 담당합니다. Nginx 제거에 따른 백엔드·AI 주소 분리와 라우팅 테스트는 후속 `codex/local-compose` 변경이며, 최신화 변경을 통합한 뒤 실행합니다.

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
API_BASE_URL=https://api.brainsecond.site/
```

현재 작업 공간의 서비스 코드는 기존 단일 API 주소를 사용합니다. 실제 사용할 통합 API 주소로 설정하고 끝의 `/`를 포함합니다. localhost의 백엔드·AI 포트를 각각 사용하는 설정은 `codex/local-compose`에서 별도로 이전합니다.

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
```

주소 분리 테스트는 `codex/local-compose`에 보관하며 최신화 변경을 통합한 뒤 실행합니다. 현재 작업 공간에 존재하지 않는 테스트를 검증 명령에 포함하지 않습니다.

Python 3.14.7에서 Mac ARM·Linux ARM 의존성 해석 및 Mac의 별도 가상환경 설치를 확인했습니다. 별도 프로세스의 stdio 연결에서도 FastMCP 클라이언트의 `auto`·`legacy` 모드 각각 도구 목록과 외부 요청 없는 입력 검증 호출을 확인했습니다. 실제 사용자의 MCP 클라이언트 연결과 개인 데이터에 대한 검색 품질은 이 검사에 포함되지 않습니다.

## 알려진 기존 제약

- `graph_note_search`의 설명에는 `depth` 기본값이 1이라고 되어 있지만 현재 도구 입력 스키마에는 필수 항목으로 등록됩니다. 현재는 `depth`를 명시해야 합니다. 기본값 누락은 버전 변경과 별개인 기존 기능 결함으로 남겨 두었습니다.
- stdio 로그와 오류 메시지는 MCP 클라이언트의 서버 로그에서 확인합니다. 인증 오류는 백엔드 API 키와 서버 주소를 확인합니다.
