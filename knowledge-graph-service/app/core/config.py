from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """애플리케이션 환경 변수 설정"""

    # Neo4j 설정
    neo4j_uri: str
    neo4j_user: str
    neo4j_password: str

    # Google Cloud Vertex AI 설정. ADC는 SDK가 기본 자격증명에서 읽는다.
    google_cloud_project: str
    google_cloud_location: str = "global"
    gemini_embedding_model: str = "gemini-embedding-2"

    # RabbitMQ 설정
    rabbitmq_host: str
    rabbitmq_port: int
    rabbitmq_user: str
    rabbitmq_password: str
    rabbitmq_vhost: str
    rabbitmq_queue: str = "note_creation_queue"

    @property
    def rabbitmq_url(self) -> str:
        """RabbitMQ URL 생성"""
        return (
            f"amqp://{self.rabbitmq_user}:{self.rabbitmq_password}"
            f"@{self.rabbitmq_host}:{self.rabbitmq_port}/{self.rabbitmq_vhost}"
        )

    # 애플리케이션 설정
    similarity_threshold: float
    max_relationships: int

    # Summarize_Agent 설정
    summarize_model: str = "gemini-3.8-flash"

    # Search_Agent 설정
    search_agent_model: str = "gemini-3.7-flash"
    top_k: int
    search_limit: int

    # external_service 설정
    secondbrain_api_url: str

    # Pydantic 설정
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
