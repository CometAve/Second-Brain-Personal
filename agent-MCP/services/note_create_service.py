# services/note_create_service.py
"""LLM 대화 노트 생성 서비스"""
import httpx
import logging

logger = logging.getLogger(__name__)


class NoteCreateService:
    """LLM 대화 노트 생성 서비스"""

    def __init__(self, api_base_url: str, api_key: str):
        self.api_base_url = api_base_url.rstrip("/") + "/"
        self.api_key = api_key

    async def note_create(
        self,
        title: str,
        content: str,
    ) -> str:
        """
        LLM 대화 노트 생성

        Args:
            title: 제목
            content: 내용

        Returns:
            str: 노트 생성/실패 안내 메시지
        """
        if not title or not content:
            logger.warning("제목 / 내용이 비어있습니다.")
            return "생성에 필요한 제목과 내용을 입력해주세요."
        try:
            payload = {
                "title": title,
                "content": content,
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.api_base_url}api/mcp/notes",
                    json=payload,
                    headers={
                        "X-API-Key": self.api_key,
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                result: dict = response.json()

            if not result.get("success"):
                logger.error(f"생성 실패: {result}")
                return "노트 생성에 실패했습니다. 다시 시도해주세요."

            note: dict = result.get("data", {})
            if not note:
                return f"노트 생성에 문제가 있습니다. {title} / {content}"

            return f"제목 : {note.get('title', '')} \n 대화 내용 노트가 생성되었습니다."

        except httpx.TimeoutException:
            logger.error("⏰ 요청 타임아웃")
            return "검색 요청이 시간 초과되었습니다. 네트워크 연결을 확인하고 다시 시도해주세요."

        except httpx.RequestError as e:
            logger.error(f"❌ 네트워크 에러: {e}")
            return f"네트워크 오류가 발생했습니다: {str(e)}"

        except Exception as e:
            logger.error(f"❌ 예상치 못한 에러: {e}", exc_info=True)
            return f"검색 중 예상치 못한 오류가 발생했습니다: {str(e)} {content}"
