package uknowklp.secondbrain.api.note.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import uknowklp.secondbrain.api.note.domain.NoteDraft;
import uknowklp.secondbrain.api.note.repository.DraftPromotionRepository;
import uknowklp.secondbrain.global.exception.BaseException;
import uknowklp.secondbrain.global.response.BaseResponseStatus;

class NoteDraftServiceFailureTest {
	@Test
	void redisReadFailureDoesNotBecomeDraftNotFound() {
		@SuppressWarnings("unchecked")
		RedisTemplate<String, NoteDraft> redis = mock(RedisTemplate.class);
		@SuppressWarnings("unchecked")
		ValueOperations<String, NoteDraft> values = mock(ValueOperations.class);
		when(redis.opsForValue()).thenReturn(values);
		when(values.get("draft:note:sample"))
			.thenThrow(new RedisConnectionFailureException("synthetic disconnect"));
		NoteDraftService service = new NoteDraftService(redis,
			mock(RedisTemplate.class), mock(StringRedisTemplate.class),
			mock(DraftLockService.class), mock(DraftPromotionRepository.class));

		assertThatThrownBy(() -> service.getDraft("sample", 1L))
			.isInstanceOfSatisfying(BaseException.class,
				error -> assertThat(error.getStatus()).isEqualTo(BaseResponseStatus.REDIS_ERROR));
	}
}
