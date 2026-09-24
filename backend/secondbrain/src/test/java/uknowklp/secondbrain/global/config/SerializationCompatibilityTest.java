package uknowklp.secondbrain.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.test.util.ReflectionTestUtils;

import tools.jackson.databind.json.JsonMapper;
import uknowklp.secondbrain.api.note.domain.NoteDraft;
import uknowklp.secondbrain.api.note.dto.KnowledgeGraphEvent;
import uknowklp.secondbrain.api.user.domain.User;
import uknowklp.secondbrain.global.security.jwt.JwtProvider;
import uknowklp.secondbrain.global.security.oauth2.dto.AuthCodeData;

class SerializationCompatibilityTest {
	private final JsonMapper mapper = new JacksonConfig().jsonMapper();
	private final RedisConnectionFactory connectionFactory = mock(RedisConnectionFactory.class);

	@Test
	void draftRetainsTextVersionAndIsoDateWithoutTypeMetadata() {
		var draft = NoteDraft.builder().noteId("draft-1").userId(42L)
			.title("한글 제목").content("내용\n두 번째 줄").version(7L)
			.lastModified(LocalDateTime.of(2026, 9, 24, 15, 30)).build();
		// RedisTemplate의 getter는 값 타입을 ?로 지웁니다. 이 팩터리는 NoteDraft 전용입니다.
		@SuppressWarnings("unchecked")
		var serializer = (RedisSerializer<NoteDraft>) new RedisConfig()
			.noteDraftRedisTemplate(connectionFactory, mapper).getValueSerializer();
		byte[] bytes = serializer.serialize(draft);
		String json = new String(bytes, StandardCharsets.UTF_8);
		assertThat(json).contains("2026-09-24T15:30:00").doesNotContain("@class");
		assertThat(serializer.deserialize(bytes)).usingRecursiveComparison().isEqualTo(draft);
	}

	@Test
	void redisReadsExistingAuthorizationCodeAndRefreshTokenFormats() {
		var serializer = assertInstanceOf(GenericJacksonJsonRedisSerializer.class,
			new RedisConfig().redisTemplate(connectionFactory).getValueSerializer());
		String legacy = """
			{"@class":"uknowklp.secondbrain.global.security.oauth2.dto.AuthCodeData",
			 "userId":42,"email":"local@example.test","createdAt":1700000000000}
			""";
		Object restored = serializer.deserialize(legacy.getBytes(StandardCharsets.UTF_8));
		assertThat(restored).isInstanceOf(AuthCodeData.class);
		var data = (AuthCodeData) restored;
		assertThat(data.getUserId()).isEqualTo(42L);
		assertThat(data.getCreatedAt()).isEqualTo(1700000000000L);
		assertThat(serializer.deserialize(serializer.serialize(data)))
			.usingRecursiveComparison().isEqualTo(data);
		assertThat(serializer.deserialize("\"refresh-token\"".getBytes(StandardCharsets.UTF_8)))
			.isEqualTo("refresh-token");
	}

	@Test
	void rabbitEventKeepsPythonConsumersSnakeCaseContract() {
		var event = KnowledgeGraphEvent.created(12L, 42L, "제목", "본문");
		var message = new RabbitMQConfig().jsonMessageConverter()
			.toMessage(event, new MessageProperties());
		var body = mapper.readTree(message.getBody());
		assertThat(message.getMessageProperties().getContentType()).isEqualTo("application/json");
		assertThat(body.get("event_type").asString()).isEqualTo("note.created");
		assertThat(body.get("note_id").asLong()).isEqualTo(12L);
		assertThat(body.get("user_id").asLong()).isEqualTo(42L);
		assertThat(body.get("title").asString()).isEqualTo("제목");
		assertThat(body.has("noteId")).isFalse();
	}

	@Test
	void jwtSignsAndReadsUserIdentityWithRuntimeJsonProvider() {
		var provider = new JwtProvider("local-test-secret-at-least-32-bytes-long",
			Duration.ofMinutes(5), Duration.ofDays(1));
		ReflectionTestUtils.invokeMethod(provider, "init");
		var user = User.builder().id(42L).email("local@example.test").build();
		String token = provider.createAccessToken(user);
		assertThat(provider.validateToken(token)).isTrue();
		assertThat(provider.getUserId(token)).isEqualTo(42L);
		assertThat(provider.getClaims(token).getSubject()).isEqualTo(user.getEmail());
		assertThat(provider.validateToken(token + "corrupted")).isFalse();
	}
}
