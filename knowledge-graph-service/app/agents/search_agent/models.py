from app.services.gemini_chat_model import GeminiCloudChatModel
from app.core.config import get_settings

from app.schemas.agents import PreFilterOutput, RelevanceCheckOutput


class Models:
    """
    ## LLM 모델 정의
    - init : 환경변수 정의
    - get_rewrite_model : 쿼리 재작성 에이전트
    - get_related_check_model : content 내용 관련성 체크 에이전트
    - get_result_model : 최종 응답 생성 에이전트
    """

    def __init__(self):
        self.settings = get_settings()

    def _model(self) -> GeminiCloudChatModel:
        return GeminiCloudChatModel(
            model=self.settings.search_agent_model,
            vertexai=True,
            project=self.settings.google_cloud_project,
            location=self.settings.google_cloud_location,
            thinking_level="low",
        )

    def get_prefilter_model(self):
        """Pre-filter용 structured output 모델"""
        model = self._model()
        return model.with_structured_output(PreFilterOutput)

    def get_relevance_check_model(self):
        """연관성 체크용 structured output 모델"""
        model = self._model()
        return model.with_structured_output(RelevanceCheckOutput)

    def get_response_model(self):
        """응답 생성용 일반 모델"""
        return self._model()
