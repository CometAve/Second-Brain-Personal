import logging
from typing import List, Dict, Optional
from app.agents.search_agent.graph import Graph
from app.agents.search_agent.state import State
from app.core.config import get_settings

from app.schemas.agents import TimeFilter

settings = get_settings()

logger = logging.getLogger(__name__)


class AgentSearchService:
    """
    LLM을 활용하여 지식 그래프 내에서 검색 수행
    """

    def __init__(self):
        self.graph = Graph.create_search_graph()
        self.mcp_graph = Graph.create_mcp_search_graph()
        self.TOP_K = settings.top_k

    async def search(
        self,
        user_id: int,
        query: str,
    ) -> Dict:
        """
        지식 그래프 내에서 검색 수행

        Args:
            user_id: 사용자 ID
            query: 검색 쿼리

        Returns:
            dict: 검색 결과 및 응답
        """
        if not query:
            logger.warning("⚠️ Empty query provided")
            return {
                "response": "",
                "documents": [],
            }
        try:
            initial_state: State = {
                "user_id": user_id,
                "original_query": query,
            }
            result = await self.graph.ainvoke(initial_state)
            documents: List[Dict] = result.get("documents", [])
            return {
                "response": result.get("response", ""),
                "documents": documents[: self.TOP_K],
            }
        except Exception as e:
            logger.error(f"error : {e}")
            raise

    async def mcp_search(
        self,
        user_id: int,
        timespan: Optional[TimeFilter] = None,
        query: Optional[str] = None,
    ) -> Dict:
        """
        mcp 유사도 검색
        Args:
            user_id: 사용자 ID
            timespan: 시간 필터
            query: 검색 쿼리  
        Returns:
            dict: 검색 결과 및 응답
        """
        if not user_id: 
            logger.error("user_id is required")
            return {"documents": [], "error": "missing_user_id"}
    
        if not timespan and not query:  
            logger.warning(f"No search criteria provided for user {user_id}")
            return {"documents": [], "error": "no_criteria"}
        try:
            initial_state: State = {
                "user_id": user_id,
            }
            if timespan:
                if hasattr(timespan, 'model_dump'):
                    timespan_dict = timespan.model_dump(exclude_none=True)
                    initial_state["filters"] = {"timespan": timespan_dict}
            if query:
                initial_state["query"] = query
                initial_state["original_query"] = query

            result = await self.mcp_graph.ainvoke(initial_state)
            documents: List[Dict] = result.get("documents", [])
            return {
                "documents": documents[: self.TOP_K],
            }

        except Exception as e:
            logger.error(f"error : {e}")
            raise
    
    def image_graph(self, filename="search_graph.png"):
        """그래프를 PNG 파일로 저장"""
        png_bytes = self.graph.get_graph().draw_mermaid_png()
        
        with open(filename, "wb") as f:
            f.write(png_bytes)
        
        print(f"✅ 그래프가 '{filename}'으로 저장되었습니다.")
        return filename


agent_search_service = AgentSearchService()
