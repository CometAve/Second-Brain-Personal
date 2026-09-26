package uknowklp.secondbrain.api.note.service;

import java.util.List;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import uknowklp.secondbrain.api.gms.service.GeminiClient;

@Service
@RequiredArgsConstructor
public class EmbeddingService {
	private static final int DIMENSIONS = 1536;
	private final GeminiClient geminiClient;

	public List<Double> generateEmbedding(String query) {
		if (query == null || query.isBlank()) {
			throw new IllegalArgumentException("검색어가 비어 있습니다");
		}
		var response = geminiClient.embed("task: search result | query: " + query).block();
		if (response == null || response.embedding() == null || response.embedding().values() == null) {
			throw new IllegalStateException("Gemini 임베딩 응답이 비어 있습니다");
		}
		List<Double> values = response.embedding().values();
		if (values.size() != DIMENSIONS || values.stream().anyMatch(value -> value == null || !Double.isFinite(value))
			|| values.stream().allMatch(value -> value == 0.0)) {
			throw new IllegalStateException("Gemini 임베딩 벡터가 유효하지 않습니다");
		}
		return values;
	}
}
