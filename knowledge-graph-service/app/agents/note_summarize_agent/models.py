from app.services.gemini_chat_model import GeminiCloudChatModel
from app.core.config import get_settings
from app.schemas.agents import LLMResponse


class Models:
    """
    ## LLM 모델 정의
    - init : Google Cloud ADC와 프로젝트 설정 사용
    - summarize_model : 요약 에이전트 선언
    """
    def __init__(self):
        self.settings = get_settings()

    def summarize_model(self):
        model = GeminiCloudChatModel(
            model=self.settings.summarize_model,
            vertexai=True,
            project=self.settings.google_cloud_project,
            location=self.settings.google_cloud_location,
            thinking_level="low",
        )
        structured_model = model.with_structured_output(LLMResponse)
        return structured_model
