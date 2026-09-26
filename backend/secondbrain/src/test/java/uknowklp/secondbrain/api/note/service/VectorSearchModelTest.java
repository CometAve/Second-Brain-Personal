package uknowklp.secondbrain.api.note.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.Value;

class VectorSearchModelTest {
	@Test
	void filtersVectorResultsByWorkerEmbeddingFingerprint() {
		var driver = mock(Driver.class);
		var session = mock(Session.class);
		var result = mock(Result.class);
		when(driver.session()).thenReturn(session);
		when(session.run(anyString(), any(Value.class))).thenReturn(result);
		when(result.stream()).thenReturn(Stream.empty());

		var service = new VectorSearchService(driver, "gemini-embedding-2");
		assertThat(service.searchSimilarNotes(7L, List.of(0.25), 10)).isEmpty();

		var query = ArgumentCaptor.forClass(String.class);
		var parameters = ArgumentCaptor.forClass(Value.class);
		verify(session).run(query.capture(), parameters.capture());
		assertThat(query.getValue()).contains("similar_note.embedding_model = $embeddingModel");
		assertThat(parameters.getValue().get("embeddingModel").asString())
			.isEqualTo("google-cloud/gemini-embedding-2/1536/prefix-v1");
	}
}
