package uknowklp.secondbrain.api.note.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import uknowklp.secondbrain.global.config.JacksonConfig;

class EmbeddingCompatibilityTest {
	@Test
	void embeddingSdkKeepsRequestAndConvertsFloatVectorToApplicationDoubles() throws Exception {
		var requestBody = new AtomicReference<String>();
		var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/v1/embeddings", exchange -> {
			requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
			byte[] body = """
				{"object":"list","model":"text-embedding-3-small",
				 "data":[{"object":"embedding","index":0,"embedding":[0.25,-0.125,1.0]}],
				 "usage":{"prompt_tokens":2,"total_tokens":2}}
				""".getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(200, body.length);
			try (var output = exchange.getResponseBody()) { output.write(body); }
		});
		server.start();
		try {
			var service = new EmbeddingService();
			ReflectionTestUtils.setField(service, "apiKey", "local-test");
			ReflectionTestUtils.setField(service, "embeddingModel", "text-embedding-3-small");
			ReflectionTestUtils.setField(service, "openaiBaseUrl", "http://127.0.0.1:" + server.getAddress().getPort() + "/v1");
			service.init();
			assertThat(service.generateEmbedding("검색어")).containsExactly(0.25, -0.125, 1.0);
			var request = new JacksonConfig().jsonMapper().readTree(requestBody.get());
			assertThat(request.get("model").asString()).isEqualTo("text-embedding-3-small");
			assertThat(request.get("input").asString()).isEqualTo("검색어");
			assertThat(request.get("encoding_format").asString()).isEqualTo("float");
		} finally {
			server.stop(0);
		}
	}
}
