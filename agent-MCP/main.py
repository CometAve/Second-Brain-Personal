# main.py
"""FastMCP 서버: 개인 노트 검색"""
import logging
import os
from typing import Optional

from dotenv import load_dotenv
from fastmcp import FastMCP
from pydantic import Field

from services.search_service import SearchService
from services.note_create_service import NoteCreateService
from services.graph_note_search_service import GraphNoteSearchService

# 환경 변수 로드
load_dotenv()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 환경 변수
API_BASE_URL = os.getenv("API_BASE_URL")
# 기존 통합 API 주소를 사용하는 설정도 계속 지원한다.
AI_API_BASE_URL = os.getenv("AI_API_BASE_URL") or API_BASE_URL
API_KEY = os.getenv("API_KEY")

if not API_KEY or not API_BASE_URL:
    raise ValueError("환경변수 API_BASE_URL과 API_KEY가 필요합니다")


# FastMCP 서버 초기화
mcp = FastMCP(
    "Personal Notes Search Server: Second Brain",
)

# 검색 서비스 인스턴스
search_service = SearchService(api_base_url=AI_API_BASE_URL, api_key=API_KEY)
note_create_service = NoteCreateService(api_base_url=API_BASE_URL, api_key=API_KEY)
graph_note_search_service = GraphNoteSearchService(
    api_base_url=API_BASE_URL, api_key=API_KEY, ai_api_base_url=AI_API_BASE_URL
)

# ==========================
# MCP 도구 등록
# ==========================


@mcp.tool(
    name="search_personal_notes",
    description="""
    # 개인 노트를 자연어로 검색합니다.
    
    검색 방법:
    1. 유사도 검색을 위한 쿼리가 존재하면, 유사도 검색 실시
    2. 쿼리가 제공되지 않았으면, 시간 범위로 필터링한 노트 제공
    3. 시간과 쿼리 둘 다 제공시 시간 범위 내에 유사한 노트 검색 후 제공
    4. 둘 다 제공하지 않을 시 검색 불가
    
    예시:
    - "어제 작성한 노트 바탕으로 찾아줘" : 시간 필터
    - "오늘 작성한 파이썬 관련 노트로 대답해줘" : 시간 필터 + 의미 검색
    - "지식 그래프 구축 방법론에 대해 정리한 노트 찾아줘" : 의미 검색
    """,
)
async def search_personal_notes(
    query: Optional[str] = Field(
        default=None,
        description="검색할 내용을 자연어로 입력하세요. 예: '지난주 작성한 머신러닝 관련 노트', 'React Hooks 사용법'",
    ),
    start: Optional[str] = Field(
        default=None,
        description="검색 시작 날짜 (ISO 8601 형식: YYYY-MM-DDTHH:MM:SS+09:00)",
    ),
    end: Optional[str] = Field(
        default=None,
        description="검색 종료 날짜 (ISO 8601 형식: YYYY-MM-DDTHH:MM:SS+09:00)",
    ),
) -> str:
    """MCP 도구: 개인 노트 검색"""
    return await search_service.search_notes(query=query, start=start, end=end)


@mcp.tool(
    name="note_create",
    description="""
    # 개인 노트공간에 노트를 생성합니다.

    사용자의 요청에 의해 노트를 생성할 수 있습니다.
    요청 내용에 알맞은 제목과 본문을 구성해야 합니다.
    
    사용자는 대화내용을 요약하여 저장해달라고 요청할 수도 있고, 새로운 학습 내용과 같은 것을 저장 요청 할 수 있습니다.
    사용자의 요청에 알맞은 노트를 생성하여 저장해주세요.
    
    작성 규칙:
    1. 본문 내용은 항상 **MarkDown**형식으로 작성해야 합니다.
    2. 내용의 길이제한은 없지만 최대한 요약해서 작성합니다.
    3. title과 content는 항상 작성해서 요청해야 합니다.
    4. 제목은 본문 내용을 알기 쉽고 검색하기 용이하게 작성해야 합니다.
    5. 본문의 개행에 직접 개행문자를 작성해 한줄로 작성합니다,(직렬화 문제)
    
    """,
)
async def note_create(
    title: str = Field(
        description="저장할 노트의 전체 내용을 포함하는 제목을 작성해야 합니다. 내용 파악과 검색에 용이하게 핵심 키워드를 포함한 적절한 문장으로 제목을 작성해주세요."
    ),
    content: str = Field(
        description="사용자가 요청한 내용의 본문을 작성해야 합니다. 노트 본문 내용. 반드시 Markdown 형식으로 작성하세요. 개행문자를 이용해 작성하세요. 예를 들어 어떤 자료에 대한 조사를 바탕으로 글을 적거나 대화 내용에 대한 요약을 통해 노트를 작성할 수 있습니다. 적절한 내용을 노트의 본문으로 작성하여 요청하세요."
    ),
) -> str:
    """LLM 대화 노트 저장"""
    return await note_create_service.note_create(title=title, content=content)


@mcp.tool(
    name="graph_note_search",
    description="""
    # 특정 노트와 연결된 주변 노트들을 그래프 기반으로 탐색합니다.
    
    노트 간의 연결 관계를 따라 지정된 깊이만큼 탐색하여
    관련된 노트들의 상세 정보를 검색합니다.
    
    사용 방법:
    1. 노트 ID를 알고 있는 경우: 해당 ID로 직접 탐색
    2. 노트 ID를 모르는 경우: 먼저 'search_personal_notes' 도구로 노트를 검색하여 ID 확인
    3. depth 값으로 탐색 범위 조절 (기본값: 1, 높을수록 더 많은 연결 노트 탐색)
    
    반환 정보:
    - 연결된 각 노트의 제목, ID, 작성일, 수정일, 본문 내용
    """
)
async def graph_note_search(
        note_id: int = Field(
            description="탐색을 시작할 노트의 ID입니다. 필수 입력값이며, ID를 모르는 경우 'search_personal_notes' 도구를 먼저 사용하여 검색하세요."
        ),
        depth: Optional[int] =Field(
            description="그래프 탐색 깊이입니다. 기본값은 1이며, 값이 클수록 더 멀리 연결된 노트까지 탐색합니다. 예: 1(직접 연결), 2(2단계 연결)"
        ),
) -> str:
    """"""
    return await graph_note_search_service.graph_note_search(note_id=note_id, depth=depth)


# ==========================
# 서버 실행
# ==========================

if __name__ == "__main__":
    logger.info("🚀 FastMCP 서버 시작")
    logger.info(f"📡 API URL: {API_BASE_URL}")
    logger.info(f"📡 AI API URL: {AI_API_BASE_URL}")
    logger.info(f"🔑 API Key: {API_KEY[:10]}..." if API_KEY else "❌ API Key 없음")

    mcp.run(transport="stdio")
