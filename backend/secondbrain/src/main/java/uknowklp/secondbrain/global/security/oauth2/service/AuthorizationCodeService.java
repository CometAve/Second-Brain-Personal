package uknowklp.secondbrain.global.security.oauth2.service;

import java.time.Duration;
import java.util.UUID;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;
import uknowklp.secondbrain.global.security.oauth2.dto.AuthCodeData;

/**
 * Authorization Code 관리 서비스
 * OAuth2 로그인 후 임시 인증 코드를 생성하고 관리합니다.
 *
 * 보안 특징:
 * - One-time use: 코드 사용 시 즉시 삭제
 * - Short TTL: 5분 제한으로 replay attack 방지
 * - Redis 저장: 인메모리 저장으로 빠른 검증
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthorizationCodeService {

	private final RedisTemplate<String, Object> redisTemplate;

	// Redis key pattern
	private static final String AUTH_CODE_PREFIX = "auth:code:";

	// Authorization Code TTL (5분)
	private static final long CODE_TTL_SECONDS = 300;

	/**
	 * Authorization Code 생성 및 Redis 저장
	 *
	 * @param userId 사용자 ID
	 * @param email 사용자 이메일
	 * @return 생성된 Authorization Code (UUID)
	 */
	public String generateCode(Long userId, String email) {
		String code = UUID.randomUUID().toString();
		String key = AUTH_CODE_PREFIX + code;

		AuthCodeData data = new AuthCodeData(userId, email, System.currentTimeMillis());

		// RedisTemplate이 GenericJacksonJsonRedisSerializer를 사용하므로 객체를 직접 저장
		redisTemplate.opsForValue().set(key, data, Duration.ofSeconds(CODE_TTL_SECONDS));
		log.debug("Authorization code generated and stored. UserId: {}, Code: {}, TTL: {}s",
			userId, code, CODE_TTL_SECONDS);
		return code;
	}

	/**
	 * Authorization Code 검증 및 일회성 소비
	 * Code를 검증하고 즉시 Redis에서 삭제하여 재사용 방지
	 *
	 * @param code Authorization Code
	 * @return AuthCodeData 인증 코드 데이터
	 * @throws BaseException Code가 유효하지 않거나 만료된 경우
	 */
	public AuthCodeData validateAndConsume(String code) {
		String key = AUTH_CODE_PREFIX + code;

		// Redis에서 코드 조회 및 즉시 삭제 (atomic operation)
		// RedisTemplate의 GenericJacksonJsonRedisSerializer가 자동으로 역직렬화
		Object value = redisTemplate.opsForValue().getAndDelete(key);

		if (value == null) {
			log.warn("Invalid or expired authorization code: {}", code);
			throw new BaseException(BaseResponseStatus.INVALID_AUTHORIZATION_CODE);
		}

		// 타입 캐스팅으로 AuthCodeData 객체 복원
		AuthCodeData data = (AuthCodeData)value;
		log.info("Authorization code validated and consumed. UserId: {}, Email: {}",
			data.getUserId(), data.getEmail());
		return data;
	}
}
