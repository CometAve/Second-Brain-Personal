package uknowklp.secondbrain.global.config;

import java.util.Collection;
import java.util.Map;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import uknowklp.secondbrain.global.security.oauth2.dto.AuthCodeData;

import uknowklp.secondbrain.api.note.domain.NoteDraft;

/**
 * Redis 설정
 *
 * RedisTemplate<String, Object> 빈을 생성하여 다양한 타입의 데이터를 Redis에 저장할 수 있도록 합니다.
 *
 * Serialization 전략:
 * - Key: StringRedisSerializer (사람이 읽기 쉬운 문자열)
 * - Value: GenericJacksonJsonRedisSerializer (JSON 직렬화, 타입 정보 포함)
 *
 * Spring Data Redis Best Practices:
 * - RedisConnectionFactory는 Spring Boot가 application.yml 설정을 기반으로 자동 생성
 * - GenericJacksonJsonRedisSerializer를 사용하여 다양한 타입(String, Map, etc.) 처리
 * - 타입 특화 RedisTemplate은 성능 최적화와 타입 안정성 제공
 * - afterPropertiesSet()으로 초기화 보장
 *
 * @see <a href="https://docs.spring.io/spring-data/redis/docs/current/reference/html/#redis:template">Spring Data Redis - RedisTemplate</a>
 */
@Configuration
public class RedisConfig {

	/**
	 * RedisTemplate<String, Object> 빈 생성
	 *
	 * 이 템플릿은 다음 용도로 사용됩니다:
	 * - JWT Refresh Token 저장 (Map<String, Object>)
	 * - Token Blacklist 관리 (String)
	 * - OAuth2 인증 코드 저장 (String)
	 *
	 * @param connectionFactory Spring Boot가 자동 생성한 RedisConnectionFactory
	 * @return 설정된 RedisTemplate 인스턴스
	 */
	@Bean
	public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
		RedisTemplate<String, Object> template = new RedisTemplate<>();
		template.setConnectionFactory(connectionFactory);

		// Key Serializer: String으로 직렬화
		// Redis에서 키를 사람이 읽을 수 있는 문자열로 저장
		StringRedisSerializer stringSerializer = new StringRedisSerializer();
		template.setKeySerializer(stringSerializer);
		template.setHashKeySerializer(stringSerializer);

		// Value Serializer: JSON으로 직렬화
		// GenericJacksonJsonRedisSerializer는 타입 정보(@class)를 포함하여
		// 다양한 타입의 객체를 안전하게 직렬화/역직렬화할 수 있습니다.
		GenericJacksonJsonRedisSerializer jsonSerializer = GenericJacksonJsonRedisSerializer.builder()
			.enableDefaultTyping(BasicPolymorphicTypeValidator.builder()
				.allowIfSubType(AuthCodeData.class)
				.allowIfSubType(Number.class)
				.allowIfSubType(Map.class)
				.allowIfSubType(Collection.class)
				.build())
			.typePropertyName("@class")
			.build();
		template.setValueSerializer(jsonSerializer);
		template.setHashValueSerializer(jsonSerializer);

		// 템플릿 초기화
		template.afterPropertiesSet();

		return template;
	}

	/**
	 * NoteDraft 전용 타입 특화 RedisTemplate 빈 생성
	 *
	 * 성능 최적화 및 타입 안정성을 위한 전용 템플릿:
	 * - NoteDraft 객체를 직접 반환하여 불필요한 타입 변환 제거
	 * - JacksonJsonRedisSerializer로 NoteDraft 타입에 최적화된 직렬화
	 * - GenericJacksonJsonRedisSerializer보다 성능 우수
	 * - ObjectMapper.convertValue() 변환 과정 불필요
	 *
	 * LocalDateTime 직렬화:
	 * - JavaTimeModule 사용으로 LocalDateTime 지원
	 * - ISO-8601 포맷으로 안전한 직렬화
	 * - @class 타입 정보 제거 (프론트엔드 호환성)
	 *
	 * 리팩토링 (v3):
	 * - ObjectMapper 주입 방식으로 변경
	 *   - 이유: JacksonConfig의 공통 Bean 사용
	 *   - 효과: 코드 중복 제거, 일관성 보장
	 *
	 * 사용처:
	 * - NoteDraftService의 모든 Draft 저장/조회 작업
	 * - NoteDraftAutoSaveService의 자동 저장 스케줄러
	 *
	 * @param connectionFactory Spring Boot가 자동 생성한 RedisConnectionFactory
	 * @param objectMapper      JacksonConfig에서 생성한 공통 JsonMapper Bean
	 * @return NoteDraft 타입 특화 RedisTemplate 인스턴스
	 * @see <a href="https://docs.spring.io/spring-data/redis/docs/current/reference/html/#redis:serializer">Redis Serializers</a>
	 */
	@Bean
	public RedisTemplate<String, NoteDraft> noteDraftRedisTemplate(
		RedisConnectionFactory connectionFactory,
		ObjectMapper objectMapper) { // 공통 ObjectMapper Bean 주입

		RedisTemplate<String, NoteDraft> template = new RedisTemplate<>();
		template.setConnectionFactory(connectionFactory);

		// Key Serializer: String으로 직렬화
		StringRedisSerializer stringSerializer = new StringRedisSerializer();
		template.setKeySerializer(stringSerializer);
		template.setHashKeySerializer(stringSerializer);

		// Value Serializer: NoteDraft 타입 특화 Jackson 직렬화
		// 주입받은 ObjectMapper 사용 (코드 중복 제거)
		// @class 타입 정보 없이 직렬화 (프론트엔드 호환성)
		JacksonJsonRedisSerializer<NoteDraft> jsonSerializer =
			new JacksonJsonRedisSerializer<>(objectMapper, NoteDraft.class);

		template.setValueSerializer(jsonSerializer);
		template.setHashValueSerializer(jsonSerializer);

		// 템플릿 초기화
		template.afterPropertiesSet();

		return template;
	}
}
