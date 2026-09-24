"""분리된 로컬 API 주소를 MCP 도구가 올바르게 사용하는지 확인한다."""

import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import httpx
from fastmcp import Client


SERVICE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_ROOT))


class ServiceRoutingTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.requests = []
        self.client_class = httpx.AsyncClient
        self.transport = httpx.MockTransport(self.respond)
        self.client_patch = patch("httpx.AsyncClient", self.make_client)
        self.client_patch.start()
        self.addCleanup(self.client_patch.stop)

    def make_client(self, **kwargs):
        return self.client_class(transport=self.transport, **kwargs)

    def load_server(self, *, split_urls=True):
        environment = {
            "API_BASE_URL": "http://backend.local:8080",
            "API_KEY": "test-placeholder",
        }
        if split_urls:
            environment["AI_API_BASE_URL"] = "http://ai.local:8000"
        spec = importlib.util.spec_from_file_location(
            "mcp_routing_test_server", SERVICE_ROOT / "main.py"
        )
        module = importlib.util.module_from_spec(spec)
        # 개발자의 실제 .env나 쉘에 설정된 인증 정보를 읽지 않는다.
        with patch.dict(os.environ, environment, clear=True), patch(
            "dotenv.load_dotenv", return_value=False
        ):
            spec.loader.exec_module(module)
        return module.mcp

    def respond(self, request):
        self.requests.append(request)
        path = request.url.path
        if path == "/ai/api/v1/agents/mcp-search":
            data = {"success": True, "documents": []}
        elif path == "/api/mcp/notes":
            data = {"success": True, "data": {"title": "테스트 노트"}}
        elif path == "/api/apikey/validate":
            data = {"success": True, "data": {"userId": 7}}
        elif path == "/ai/api/v1/graph/neighbors/1":
            data = {"neighbors": [{"neighbor_id": 2}]}
        elif path == "/api/mcp/notes/2":
            data = {"success": True, "data": {"noteId": 2, "title": "연결 노트"}}
        else:
            raise AssertionError(f"예상하지 않은 API 경로: {request.url}")
        return httpx.Response(200, json=data)

    async def test_search_and_create_use_separate_services(self):
        async with Client(self.load_server()) as client:
            await client.call_tool("search_personal_notes", {"query": "테스트"})
            await client.call_tool(
                "note_create", {"title": "테스트 노트", "content": "본문"}
            )
        self.assertEqual(
            [(request.method, str(request.url)) for request in self.requests],
            [
                ("POST", "http://ai.local:8000/ai/api/v1/agents/mcp-search"),
                ("POST", "http://backend.local:8080/api/mcp/notes"),
            ],
        )
        self.assertEqual(json.loads(self.requests[0].content), {"query": "테스트"})
        for request in self.requests:
            self.assertEqual(request.headers["X-API-Key"], "test-placeholder")

    async def test_graph_auth_and_note_fetch_use_backend(self):
        async with Client(self.load_server()) as client:
            await client.call_tool("graph_note_search", {"note_id": 1, "depth": 2})
        self.assertEqual(
            [(request.method, str(request.url)) for request in self.requests],
            [
                ("POST", "http://backend.local:8080/api/apikey/validate"),
                ("GET", "http://ai.local:8000/ai/api/v1/graph/neighbors/1?depth=2"),
                ("GET", "http://backend.local:8080/api/mcp/notes/2"),
            ],
        )
        self.assertEqual(
            json.loads(self.requests[0].content), {"apiKey": "test-placeholder"}
        )
        self.assertEqual(self.requests[1].headers["X-User-ID"], "7")
        self.assertEqual(self.requests[2].headers["X-API-Key"], "test-placeholder")

    async def test_unified_api_address_remains_supported(self):
        async with Client(self.load_server(split_urls=False)) as client:
            await client.call_tool("search_personal_notes", {"query": "테스트"})
            await client.call_tool("graph_note_search", {"note_id": 1, "depth": 1})
        self.assertEqual(len(self.requests), 4)
        self.assertTrue(
            all(request.url.host == "backend.local" for request in self.requests)
        )


if __name__ == "__main__":
    unittest.main()
