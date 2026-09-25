package uknowklp.secondbrain.api.note.service;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;

/** Serializes operations on one draft; the DB promotion claim remains the final duplicate barrier. */
@Service
@RequiredArgsConstructor
@Slf4j
public class DraftLockService {
	static String key(String draftId) { return "lock:draft:note:" + draftId; }
	private static final Duration LEASE = Duration.ofMinutes(5);
	private static final int ATTEMPTS = 100;
	private static final long RETRY_MILLIS = 25;
	private static final DefaultRedisScript<Long> RELEASE = new DefaultRedisScript<>(
		"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
		Long.class);

	private final StringRedisTemplate redis;

	public <Result> Result withLock(String draftId, Function<String, Result> operation) {
		String key = key(draftId);
		String token = UUID.randomUUID().toString();
		boolean acquired = false;
		try {
			for (int attempt = 0; attempt < ATTEMPTS; attempt++) {
				Boolean result = redis.opsForValue().setIfAbsent(key, token, LEASE);
				if (Boolean.TRUE.equals(result)) {
					acquired = true;
					break;
				}
				if (result == null) {
					throw new BaseException(BaseResponseStatus.REDIS_ERROR);
				}
				Thread.sleep(RETRY_MILLIS);
			}
			if (!acquired) {
				throw new BaseException(BaseResponseStatus.DRAFT_ALREADY_PROCESSING);
			}
			return operation.apply(token);
		} catch (InterruptedException error) {
			Thread.currentThread().interrupt();
			throw new BaseException(BaseResponseStatus.REDIS_ERROR);
		} finally {
			if (acquired) {
				try {
					redis.execute(RELEASE, List.of(key), token);
				} catch (Exception error) {
					// The lease expires independently. Do not replace a committed DB result
					// with an unlock error; the durable promotion record governs retries.
					log.warn("Draft lock release failed: {}", draftId, error);
				}
			}
		}
	}
}
