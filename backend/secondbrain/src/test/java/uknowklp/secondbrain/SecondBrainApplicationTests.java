package uknowklp.secondbrain;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Tag;
import org.neo4j.driver.Driver;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import uknowklp.secondbrain.api.note.domain.NoteDocument;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Tag("integration")
@ActiveProfiles("local")
class SecondBrainApplicationTests {
	@Autowired private JdbcTemplate jdbc;
	@Autowired private StringRedisTemplate redis;
	@Autowired private ElasticsearchOperations elasticsearch;
	@Autowired private Driver neo4j;
	@Autowired private RabbitTemplate rabbit;
	@Autowired private JsonMapper mapper;
	@Value("${local.server.port}") private int port;

	@Test
	void localDataServicesAreReachableWithUpgradedDrivers() {
		assertThat(jdbc.queryForObject("SELECT 1", Integer.class)).isEqualTo(1);
		String key = "dependency-test:" + UUID.randomUUID();
		try {
			redis.opsForValue().set(key, "ok", Duration.ofSeconds(30));
			assertThat(redis.opsForValue().get(key)).isEqualTo("ok");
		} finally {
			redis.delete(key);
		}
		assertThat(elasticsearch.indexOps(NoteDocument.class).exists()).isTrue();
		neo4j.verifyConnectivity();
		try (var session = neo4j.session()) {
			assertThat(session.run("RETURN 1 AS value").single().get("value").asInt()).isEqualTo(1);
		}
		rabbit.execute(channel -> {
			channel.exchangeDeclarePassive("knowledge_graph_events");
			channel.queueDeclarePassive("note_creation_queue");
			return null;
		});
	}

	@Test
	void healthAndOpenApiWorkWithBootAndJacksonUpgrades() throws Exception {
		try (var client = HttpClient.newHttpClient()) {
			var health = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/health"))
				.timeout(Duration.ofSeconds(10)).build(), HttpResponse.BodyHandlers.ofString());
			assertThat(health.statusCode()).isEqualTo(200);
			assertThat(health.body()).isEqualTo("ok");
			var docs = client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/v3/api-docs"))
				.timeout(Duration.ofSeconds(15)).build(), HttpResponse.BodyHandlers.ofString());
			assertThat(docs.statusCode()).isEqualTo(200);
			assertThat(mapper.readTree(docs.body()).get("paths").has("/api/notes")).isTrue();
		}
	}
}
