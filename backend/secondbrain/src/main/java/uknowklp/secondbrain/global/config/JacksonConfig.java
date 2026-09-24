package uknowklp.secondbrain.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import tools.jackson.databind.cfg.DateTimeFeature;
import tools.jackson.databind.json.JsonMapper;

/** HTTP 응답과 Redis 초안의 날짜를 ISO-8601 문자열로 유지합니다. */
@Configuration
public class JacksonConfig {

	@Bean
	@Primary
	public JsonMapper jsonMapper() {
		return JsonMapper.builder()
			.findAndAddModules()
			.disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
			.build();
	}
}
