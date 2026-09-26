"""Offline checks for Gemini request contracts and lossless worker failures."""

import json
import os
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.genai import types
from langchain_core.messages import AIMessage


SYNTHETIC_SETTINGS = {
    "NEO4J_URI": "bolt://localhost:7687",
    "NEO4J_USER": "neo4j",
    "NEO4J_PASSWORD": "test",
    "RABBITMQ_HOST": "localhost",
    "RABBITMQ_PORT": "5672",
    "RABBITMQ_USER": "guest",
    "RABBITMQ_PASSWORD": "guest",
    "RABBITMQ_VHOST": "/",
    "SIMILARITY_THRESHOLD": "0.7",
    "MAX_RELATIONSHIPS": "10",
    "TOP_K": "3",
    "SEARCH_LIMIT": "10",
    "SECONDBRAIN_API_URL": "http://localhost",
    "GOOGLE_CLOUD_PROJECT": "synthetic-project",
}
for name, value in SYNTHETIC_SETTINGS.items():
    os.environ.setdefault(name, value)

from app.agents.search_agent.models import Models as SearchModels  # noqa: E402
from app.agents.search_agent.utils.neo4j_query_builder import (  # noqa: E402
    build_similarity_search_cypher,
)
from app.agents.note_summarize_agent.models import Models as SummarizeModels  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.services.embedding_service import EmbeddingService  # noqa: E402

# The existing Neo4j singleton verifies connectivity during import.
with patch("neo4j.GraphDatabase.driver"):
    from app.crud import note as note_crud  # noqa: E402
    from app.agents.search_agent import nodes as search_nodes  # noqa: E402
    from app.services.agent_search_service import AgentSearchService  # noqa: E402
    from app.services.similarity_service import similarity_service  # noqa: E402
    from app.workers import note_consumer  # noqa: E402


def _response(values, *, token_count=7):
    return types.EmbedContentResponse(
        embeddings=[
            types.ContentEmbedding(
                values=values,
                statistics=types.ContentEmbeddingStatistics(token_count=token_count),
            )
        ]
    )


def test_document_and_query_embedding_contract():
    client = MagicMock()
    client.models.embed_content.return_value = _response([1.0] * 1536)
    service = EmbeddingService(client=client)

    vector, tokens = service.generate_embedding("body", title="Heading")
    assert len(vector) == 1536
    assert tokens == 7
    assert service.model_tag == "google-cloud/gemini-embedding-2/1536/prefix-v1"
    request = client.models.embed_content.call_args.kwargs
    assert request["contents"] == "title: Heading | text: body"
    assert request["model"] == "gemini-embedding-2"
    assert request["config"].output_dimensionality == 1536
    assert request["config"].task_type is None
    assert request["config"].auto_truncate is False

    service.generate_embedding("where?", is_query=True)
    assert client.models.embed_content.call_args.kwargs["contents"] == (
        "task: search result | query: where?"
    )


@pytest.mark.parametrize("values", [[], [0.0] * 1536, [float("nan")] * 1536])
def test_invalid_embedding_is_rejected(values):
    client = MagicMock()
    client.models.embed_content.return_value = _response(values)
    with pytest.raises(ValueError, match="invalid embedding"):
        EmbeddingService(client=client).generate_embedding("body")


def test_provider_error_propagates():
    client = MagicMock()
    client.models.embed_content.side_effect = RuntimeError("provider unavailable")
    with pytest.raises(RuntimeError, match="provider unavailable"):
        EmbeddingService(client=client).generate_embedding("body")


def test_generation_models_use_google_cloud_and_structured_schemas():
    summary = SummarizeModels().summarize_model()
    prefilter = SearchModels().get_prefilter_model()
    relevance = SearchModels().get_relevance_check_model()
    response = SearchModels().get_response_model()
    for runnable in (summary, prefilter, relevance):
        model = runnable.first
        assert model.vertexai is True
        assert model.project == "synthetic-project"
        assert model.location == "global"
        assert model.temperature is None
        assert model.thinking_level == "low"
        config = model._prepare_params(stop=None)
        assert config.candidate_count == (None if model.model == "gemini-3.8-flash" else 1)
        assert config.temperature is None
        assert config.top_p is None
    assert response.model == "gemini-3.7-flash"
    assert response.temperature is None


def test_generation_model_defaults_are_separate(monkeypatch):
    monkeypatch.delenv("SUMMARIZE_MODEL", raising=False)
    monkeypatch.delenv("SEARCH_AGENT_MODEL", raising=False)
    settings = Settings(_env_file=None)
    assert settings.summarize_model == "gemini-3.8-flash"
    assert settings.search_agent_model == "gemini-3.7-flash"


def test_worker_requeues_and_stops_after_embedding_failure(monkeypatch):
    channel = MagicMock()
    method = SimpleNamespace(delivery_tag=42)
    monkeypatch.setattr(
        note_consumer.embedding_service,
        "generate_embedding",
        MagicMock(side_effect=RuntimeError("provider unavailable")),
    )
    event = {
        "event_type": "note.created",
        "note_id": 1,
        "user_id": 2,
        "title": "Title",
        "content": "Body",
    }
    with pytest.raises(RuntimeError, match="provider unavailable"):
        note_consumer.message_router(channel, method, None, json.dumps(event))
    channel.basic_nack.assert_called_once_with(delivery_tag=42, requeue=True)
    channel.stop_consuming.assert_called_once_with()
    channel.basic_ack.assert_not_called()


def test_worker_requeues_missing_note_update(monkeypatch):
    channel = MagicMock()
    method = SimpleNamespace(delivery_tag=43)
    monkeypatch.setattr(note_consumer.note_crud, "update_note", lambda **kwargs: False)
    event = {
        "event_type": "note.updated",
        "note_id": 1,
        "user_id": 2,
        "title": "New title",
    }
    with pytest.raises(ValueError, match="갱신할 노트"):
        note_consumer.message_router(channel, method, None, json.dumps(event))
    channel.basic_nack.assert_called_once_with(delivery_tag=43, requeue=True)
    channel.stop_consuming.assert_called_once_with()
    channel.basic_ack.assert_not_called()


def test_worker_requeues_explicit_empty_content(monkeypatch):
    channel = MagicMock()
    method = SimpleNamespace(delivery_tag=44)
    monkeypatch.setattr(
        note_consumer.note_crud,
        "get_note",
        lambda user_id, note_id: {"title": "Current title"},
    )
    embedding = MagicMock(side_effect=ValueError("Embedding input must not be empty"))
    monkeypatch.setattr(note_consumer.embedding_service, "generate_embedding", embedding)
    event = {
        "event_type": "note.updated",
        "note_id": 1,
        "user_id": 2,
        "content": "",
    }
    with pytest.raises(ValueError, match="must not be empty"):
        note_consumer.message_router(channel, method, None, json.dumps(event))
    embedding.assert_called_once_with("", title="Current title")
    channel.basic_nack.assert_called_once_with(delivery_tag=44, requeue=True)
    channel.stop_consuming.assert_called_once_with()
    channel.basic_ack.assert_not_called()


def test_duplicate_note_create_updates_same_node(monkeypatch):
    session = MagicMock()
    context = MagicMock()
    context.__enter__.return_value = session
    monkeypatch.setattr(note_crud.neo4j_client, "get_session", lambda: context)

    note_crud.create_note(
        note_id=1,
        user_id=2,
        title="Title",
        embedding=[1.0] * 1536,
        embedding_model="google-cloud/gemini-embedding-2/1536/prefix-v1",
    )
    query, parameters = session.run.call_args.args
    assert "MERGE (n:Note {note_id: $note_id, user_id: $user_id})" in query
    assert "n.embedding_model = $embedding_model" in query
    assert parameters["embedding_model"] == "google-cloud/gemini-embedding-2/1536/prefix-v1"


def test_similarity_relationship_retry_updates_one_pair(monkeypatch):
    session = MagicMock()
    session.run.return_value.single.return_value = {"created": 1}
    context = MagicMock()
    context.__enter__.return_value = session
    monkeypatch.setattr(note_crud.neo4j_client, "get_session", lambda: context)
    monkeypatch.setattr(
        similarity_service,
        "find_similar_notes",
        lambda **kwargs: [{"note_id": 3, "similarity_score": 0.8}],
    )

    for _ in range(2):
        assert similarity_service.create_similarity_relationships(2, 1, [1.0] * 1536) == 1
    query = session.run.call_args.args[0]
    assert "MERGE (n)-[r:SIMILAR_TO]-(similar)" in query
    assert "SET r.score = $score" in query
    assert "MERGE (n)-[r:SIMILAR_TO {score:" not in query


def test_similarity_relationship_failure_propagates(monkeypatch):
    session = MagicMock()
    session.run.side_effect = RuntimeError("Neo4j unavailable")
    context = MagicMock()
    context.__enter__.return_value = session
    monkeypatch.setattr(note_crud.neo4j_client, "get_session", lambda: context)
    monkeypatch.setattr(
        similarity_service,
        "find_similar_notes",
        lambda **kwargs: [{"note_id": 3, "similarity_score": 0.8}],
    )
    with pytest.raises(RuntimeError, match="Neo4j unavailable"):
        similarity_service.create_similarity_relationships(2, 1, [1.0] * 1536)


def test_similarity_queries_filter_embedding_model(monkeypatch):
    tag = "google-cloud/gemini-embedding-2/1536/prefix-v1"
    query, params = build_similarity_search_cypher([1.0] * 1536, tag, user_id=2)
    assert "n.embedding_model = $embedding_model" in query
    assert params["embedding_model"] == tag

    session = MagicMock()
    session.run.return_value = []
    context = MagicMock()
    context.__enter__.return_value = session
    monkeypatch.setattr(note_crud.neo4j_client, "get_session", lambda: context)
    similarity_service.find_similar_notes(2, 1, [1.0] * 1536)
    query, params = session.run.call_args.args
    assert "similar_note.embedding_model = $embedding_model" in query
    assert params["embedding_model"] == tag


def test_worker_uses_configured_queue(monkeypatch):
    service = MagicMock()
    service.connect.return_value = True
    service.declare_exchange_and_queue.return_value = True
    monkeypatch.setattr(note_consumer, "rabbitmq_service", service)
    monkeypatch.setattr(
        note_consumer,
        "get_settings",
        lambda: SimpleNamespace(rabbitmq_queue="gemini_notes"),
    )
    note_consumer.start_consumer()
    assert service.declare_exchange_and_queue.call_args.kwargs["queue_name"] == "gemini_notes"
    assert service.consume_messages.call_args.kwargs["queue_name"] == "gemini_notes"


@pytest.mark.parametrize(
    "content, expected",
    [
        ("Found a note", "Found a note"),
        (
            [
                {"type": "reasoning", "reasoning": "private reasoning"},
                {"type": "text", "text": "Found a note"},
            ],
            "Found a note",
        ),
    ],
)
@pytest.mark.parametrize("search_type", ["direct_answer", "similarity"])
def test_search_generation_extracts_only_text(monkeypatch, content, expected, search_type):
    llm = SimpleNamespace(ainvoke=AsyncMock(return_value=AIMessage(content=content)))
    monkeypatch.setattr(
        search_nodes,
        "Models",
        lambda: SimpleNamespace(get_response_model=lambda: llm),
    )
    state = {
        "original_query": "synthetic garden question",
        "search_type": search_type,
        "documents": [{"title": "synthetic garden note"}],
    }
    result = asyncio.run(search_nodes.Nodes.generate_response_node(state))
    assert type(result["response"]) is str
    assert result["response"] == expected
    assert "private reasoning" not in result["response"]


def test_prefilter_provider_failure_propagates(monkeypatch):
    llm = SimpleNamespace(ainvoke=AsyncMock(side_effect=RuntimeError("provider unavailable")))
    monkeypatch.setattr(
        search_nodes,
        "Models",
        lambda: SimpleNamespace(get_prefilter_model=lambda: llm),
    )
    with pytest.raises(RuntimeError, match="provider unavailable"):
        asyncio.run(search_nodes.Nodes.pre_filter_node({"original_query": "synthetic"}))


def test_similarity_embedding_failure_propagates(monkeypatch):
    monkeypatch.setattr(
        search_nodes.embedding_service,
        "generate_embedding",
        MagicMock(side_effect=RuntimeError("embedding unavailable")),
    )
    with pytest.raises(RuntimeError, match="embedding unavailable"):
        asyncio.run(
            search_nodes.Nodes.similarity_search_node(
                {"user_id": 1, "query": "synthetic"}
            )
        )


def test_relevance_provider_failure_propagates(monkeypatch):
    llm = SimpleNamespace(ainvoke=AsyncMock(side_effect=RuntimeError("provider unavailable")))
    monkeypatch.setattr(
        search_nodes,
        "Models",
        lambda: SimpleNamespace(get_relevance_check_model=lambda: llm),
    )
    with pytest.raises(RuntimeError, match="provider unavailable"):
        asyncio.run(
            search_nodes.Nodes.relevance_check_node(
                {"original_query": "synthetic", "documents": [{"title": "synthetic"}]}
            )
        )


def test_genuine_no_match_returns_no_result_message():
    result = asyncio.run(
        search_nodes.Nodes.generate_response_node(
            {"original_query": "synthetic", "search_type": "similarity", "documents": []}
        )
    )
    assert result["response"] == search_nodes.Prompts.GENERATE_NO_RESULT_RESPONSE


def test_final_answer_falls_back_only_with_retrieved_document(monkeypatch):
    llm = SimpleNamespace(ainvoke=AsyncMock(side_effect=RuntimeError("provider unavailable")))
    monkeypatch.setattr(
        search_nodes,
        "Models",
        lambda: SimpleNamespace(get_response_model=lambda: llm),
    )
    state = {
        "original_query": "synthetic",
        "search_type": "similarity",
        "documents": [{"title": "synthetic note"}],
    }
    result = asyncio.run(search_nodes.Nodes.generate_response_node(state))
    assert result["response"] == "노트 1개를 찾았습니다: synthetic note"

    with pytest.raises(RuntimeError, match="provider unavailable"):
        asyncio.run(
            search_nodes.Nodes.generate_response_node(
                {"original_query": "synthetic", "search_type": "direct_answer", "documents": []}
            )
        )


def test_search_service_graph_failure_propagates():
    service = object.__new__(AgentSearchService)
    service.graph = SimpleNamespace(ainvoke=AsyncMock(side_effect=RuntimeError("graph failed")))
    service.TOP_K = 3
    with pytest.raises(RuntimeError, match="graph failed"):
        asyncio.run(service.search(user_id=1, query="synthetic"))
