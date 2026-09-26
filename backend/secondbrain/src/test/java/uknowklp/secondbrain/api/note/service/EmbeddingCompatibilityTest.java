package uknowklp.secondbrain.api.note.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;
import uknowklp.secondbrain.api.gms.service.GeminiClient;
import uknowklp.secondbrain.global.config.GoogleCloudAuth;
import uknowklp.secondbrain.global.config.JacksonConfig;

class EmbeddingCompatibilityTest {
	@Test
	void sendsGeminiEmbeddingRequestAndValidatesVector() throws Exception {
		var requestBody = new AtomicReference<String>();
		var authHeader = new AtomicReference<String>();
		var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/v1/projects/test-project/locations/global/publishers/google/models/gemini-embedding-2:embedContent", exchange -> {
			requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			authHeader.set(exchange.getRequestHeaders().getFirst("Authorization"));
			String values = String.join(",", Collections.nCopies(1536, "0.25"));
			byte[] body = ("{\"embedding\":{\"values\":[" + values + "]}}").getBytes(StandardCharsets.UTF_8);
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
			var service = new EmbeddingService(client);
			assertThat(service.generateEmbedding("검색어")).hasSize(1536).containsOnly(0.25);
			assertThat(authHeader.get()).isEqualTo("Bearer local-token");
			var request = new JacksonConfig().jsonMapper().readTree(requestBody.get());
			assertThat(request.get("content").get("parts").get(0).get("text").asString())
				.isEqualTo("task: search result | query: 검색어");
			assertThat(request.get("outputDimensionality").asInt()).isEqualTo(1536);
			assertThat(request.has("embedContentConfig")).isFalse();
			assertThat(request.has("taskType")).isFalse();
		} finally {
			server.stop(0);
		}
	}

	@Test
	void rejectsInvalidEmbeddingVectors() {
		var client = mock(GeminiClient.class);
		var nonFinite = new ArrayList<>(Collections.nCopies(1536, 0.25));
		nonFinite.set(0, Double.NaN);
		for (List<Double> values : List.of(
			Collections.nCopies(1535, 0.25),
			Collections.nCopies(1536, 0.0),
			nonFinite)) {
			when(client.embed("task: search result | query: search"))
				.thenReturn(Mono.just(new GeminiClient.EmbeddingResponse(
					new GeminiClient.EmbeddingResponse.Embedding(values))));
			assertThatThrownBy(() -> new EmbeddingService(client).generateEmbedding("search"))
				.isInstanceOf(IllegalStateException.class);
		}
	}
}
