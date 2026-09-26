"""Google Cloud Gemini document and search-query embeddings."""

import logging
import math
from typing import List, Tuple

from google import genai
from google.genai import types

from app.core.config import get_settings
from app.core.constants import VectorConfig

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Create compatible 1536-dimensional vectors using application default credentials."""

    def __init__(self, client: genai.Client | None = None):
        settings = get_settings()
        self.model = settings.gemini_embedding_model
        self.model_tag = (
            f"google-cloud/{self.model}/{VectorConfig.EMBEDDING_DIMENSION}/prefix-v1"
        )
        self.client = client or genai.Client(
            enterprise=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )

    def generate_embedding(
        self, text: str, *, title: str | None = None, is_query: bool = False
    ) -> Tuple[List[float], int]:
        """Return a vector and the provider's input token count, when available.

        Gemini Embedding 2 does not support the older task_type parameter. The
        explicit prefixes distinguish document and retrieval-query inputs.
        """
        if not text or not text.strip():
            raise ValueError("Embedding input must not be empty")

        if is_query:
            contents = f"task: search result | query: {text}"
        else:
            contents = f'title: {title or "none"} | text: {text}'

        response = self.client.models.embed_content(
            model=self.model,
            contents=contents,
            config=types.EmbedContentConfig(
                output_dimensionality=VectorConfig.EMBEDDING_DIMENSION,
                auto_truncate=False,
            ),
        )
        embeddings = response.embeddings
        if not embeddings or len(embeddings) != 1 or embeddings[0].values is None:
            raise ValueError("Gemini returned no embedding")

        values = embeddings[0].values
        if (
            len(values) != VectorConfig.EMBEDDING_DIMENSION
            or any(not math.isfinite(value) for value in values)
            or not any(value != 0 for value in values)
        ):
            raise ValueError("Gemini returned an invalid embedding vector")

        statistics = embeddings[0].statistics
        if statistics and statistics.truncated:
            raise ValueError("Gemini truncated the embedding input")
        token_count = (
            int(statistics.token_count)
            if statistics and statistics.token_count is not None
            else 0
        )
        logger.debug("Embedding generated: %s dimensions", len(values))
        return values, token_count


embedding_service = EmbeddingService()
