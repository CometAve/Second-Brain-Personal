package uknowklp.secondbrain.api.note.service;

import java.util.List;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.api.note.dto.VectorSearchResult;

@Slf4j
@Service
public class VectorSearchService {

	private final Driver neo4jDriver;
	private final String embeddingModel;

	public VectorSearchService(Driver neo4jDriver, @Value("${gemini.embedding-model}") String embeddingModel) {
		this.neo4jDriver = neo4jDriver;
		this.embeddingModel = "google-cloud/" + embeddingModel + "/1536/prefix-v1";
	}

	// 벡터 인덱스 이름 정확하게 적어야함
	private static final String VECTOR_INDEX_NAME = "note_embeddings";

	// 벡터 검색 시 가져올 후보 갯수 (많을수록 느리고 정확)
	private static final int VECTOR_SEARCH_LIMIT = 100;

	// 최소 유사도 점수 임계값
	private static final double SIMILARITY_THRESHOLD = 0.7;

	// 검색어 임베딩 벡터로 유사 노트 찾기
	public List<VectorSearchResult> searchSimilarNotes(
		Long userId,
		List<Double> queryEmbedding,
		int limit
	) {
		// Neo4j의 벡터 인덱스 검색 프로시저 호출
		String query = """
            CALL db.index.vector.queryNodes($indexName, $vectorLimit, $embedding)
            YIELD node AS similar_note, score
            WHERE similar_note.user_id = $userId
              AND similar_note.embedding_model = $embeddingModel
              AND score >= $threshold
            RETURN similar_note.note_id AS noteId,
                   similar_note.title AS title,
                   score AS similarityScore
            ORDER BY score DESC
            LIMIT $limit
            """;

		try (Session session = neo4jDriver.session()) {
			// 파라미터 바인딩 및 쿼리 실행
			var result = session.run(query, Values.parameters(
				"indexName", VECTOR_INDEX_NAME,
				"vectorLimit", VECTOR_SEARCH_LIMIT,
				"embedding", queryEmbedding,
				"userId", userId,
				"embeddingModel", embeddingModel,
				"threshold", SIMILARITY_THRESHOLD,
				"limit", limit
			));

			// 결과를 DTO로 변환
			List<VectorSearchResult> results = result.stream()
				.map(record -> new VectorSearchResult(
					record.get("noteId").asLong(),
					record.get("title").asString(),
					record.get("similarityScore").asDouble()
				))
				.toList();

			log.info("Neo4j 벡터 검색 완료 - userId: {}, {}건 발견", userId, results.size());
			return results;

		} catch (Exception e) {
			log.error("Neo4j 벡터 검색 실패: {}", e.getMessage(), e);
			throw new RuntimeException("벡터 검색 중 오류 발생", e);
		}
	}
	// Neo4j 연결 상태 확인, return 값 = 연결 성공 여부
	public boolean verifyConnection() {
		try (Session session = neo4jDriver.session()) {
			var result = session.run("RETURN 1 AS num");
			return result.single().get("num").asInt() == 1;
		} catch (Exception e) {
			log.error("Neo4j 연결 확인 실패: {}", e.getMessage());
			return false;
		}
	}
}
