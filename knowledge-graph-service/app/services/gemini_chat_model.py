"""Pinned LangChain adapter for Gemini 3.8 generation requests."""

from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI


class GeminiCloudChatModel(ChatGoogleGenerativeAI):
    """Omit unsupported candidateCount from Gemini 3.8 requests.

    langchain-google-genai 4.4.0 includes candidate_count=1 even when the
    caller did not set it. Gemini 3.8 rejects that request field.
    """

    def _build_base_generation_config(
        self, stop: list[str] | None, **kwargs: Any
    ) -> dict[str, Any]:
        config = super()._build_base_generation_config(stop, **kwargs)
        if self.model.startswith("gemini-3.8-"):
            config.pop("candidate_count", None)
        return config
