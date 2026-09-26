package uknowklp.secondbrain.api.gms.service;

import java.net.URI;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import uknowklp.secondbrain.global.config.GoogleCloudAuth;

@Component
public class GeminiClient {
	private final WebClient webClient;
	private final GoogleCloudAuth auth;
	private final String endpointPrefix;
	private final String embeddingModel;
	private final String generationModel;

	public GeminiClient(@Qualifier("geminiWebClient") WebClient webClient, GoogleCloudAuth auth,
		@Value("${gemini.base-url}") String baseUrl,
		@Value("${gemini.project}") String project,
		@Value("${gemini.location}") String location,
		@Value("${gemini.embedding-model}") String embeddingModel,
		@Value("${gemini.generation-model}") String generationModel) {
		this.webClient = webClient;
		this.auth = auth;
		this.endpointPrefix = baseUrl.replaceAll("/+$", "") + "/v1/projects/" + segment(project)
			+ "/locations/" + segment(location) + "/publishers/google/models/";
		this.embeddingModel = segment(embeddingModel);
		this.generationModel = segment(generationModel);
	}

	private static String segment(String value) {
		if (value == null || !value.matches("[A-Za-z0-9][A-Za-z0-9._-]*")) {
			throw new IllegalArgumentException("잘못된 Google Cloud 리소스 식별자");
		}
		return value;
	}

	public Mono<EmbeddingResponse> embed(String text) {
		Map<String, Object> body = Map.of(
			"content", Map.of("parts", List.of(Map.of("text", text))),
			"outputDimensionality", 1536
		);
		return post(embeddingModel, "embedContent", body, EmbeddingResponse.class);
	}

	public Mono<GenerationResponse> generate(String prompt) {
		Map<String, Object> body = Map.of(
			"contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt)))),
			"generationConfig", Map.of("thinkingConfig", Map.of("thinkingLevel", "LOW"))
		);
		return post(generationModel, "generateContent", body, GenerationResponse.class);
	}

	private <T> Mono<T> post(String model, String operation, Object body, Class<T> responseType) {
		return Mono.fromCallable(auth::bearerToken)
			.subscribeOn(Schedulers.boundedElastic())
			.flatMap(token -> webClient.post()
				.uri(URI.create(endpointPrefix + model + ":" + operation))
				.contentType(MediaType.APPLICATION_JSON)
				.headers(headers -> headers.setBearerAuth(token))
				.bodyValue(body)
				.retrieve()
				.bodyToMono(responseType));
	}

	public record EmbeddingResponse(Embedding embedding) {
		public record Embedding(List<Double> values) {}
	}

	public record GenerationResponse(List<Candidate> candidates) {
		public record Candidate(Content content) {}
		public record Content(List<Part> parts) {}
		public record Part(String text) {}

		public String extractText() {
			if (candidates == null || candidates.isEmpty() || candidates.getFirst() == null
				|| candidates.getFirst().content() == null || candidates.getFirst().content().parts() == null) {
				throw new IllegalStateException("Gemini 응답에 생성된 질문이 없습니다");
			}
			String text = candidates.getFirst().content().parts().stream()
				.filter(part -> part != null && part.text() != null)
				.map(Part::text)
				.reduce("", String::concat).trim();
			if (text.isBlank()) {
				throw new IllegalStateException("Gemini 응답에 생성된 질문이 없습니다");
			}
			return text;
		}
	}
}
