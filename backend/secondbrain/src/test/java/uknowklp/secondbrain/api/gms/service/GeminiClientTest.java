package uknowklp.secondbrain.api.gms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import uknowklp.secondbrain.global.config.GoogleCloudAuth;
import uknowklp.secondbrain.global.config.JacksonConfig;

class GeminiClientTest {
	@Test
	void generationUsesCloudContractAndExtractsQuestion() throws Exception {
		var requestBody = new AtomicReference<String>();
		var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/v1/projects/test-project/locations/global/publishers/google/models/gemini-3.8-flash:generateContent", exchange -> {
			requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			byte[] body = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"질문은?\"}]}}]}".getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(200, body.length);
			try (var output = exchange.getResponseBody()) { output.write(body); }
		});
		server.start();
		try {
			var auth = mock(GoogleCloudAuth.class);
			when(auth.bearerToken()).thenReturn("local-token");
			var client = new GeminiClient(WebClient.create(), auth,
				"http://127.0.0.1:" + server.getAddress().getPort(), "test-project", "global",
				"gemini-embedding-2", "gemini-3.8-flash");
			assertThat(client.generate("노트").block().extractText()).isEqualTo("질문은?");
			var request = new JacksonConfig().jsonMapper().readTree(requestBody.get());
			assertThat(request.get("contents").get(0).get("parts").get(0).get("text").asString()).isEqualTo("노트");
			assertThat(request.get("generationConfig").get("thinkingConfig").get("thinkingLevel").asString()).isEqualTo("LOW");
			assertThat(request.get("generationConfig").has("temperature")).isFalse();
		} finally {
			server.stop(0);
		}
	}

	@Test
	void emptyGenerationIsAnErrorForCallerFallback() {
		assertThatThrownBy(() -> new GeminiClient.GenerationResponse(java.util.List.of()).extractText())
			.isInstanceOf(IllegalStateException.class);
	}
}
