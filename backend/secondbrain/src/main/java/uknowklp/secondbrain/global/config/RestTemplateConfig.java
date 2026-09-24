package uknowklp.secondbrain.global.config;

import java.time.Duration;

import org.springframework.boot.restclient.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * RestTemplate 설정
 * Google OAuth API 호출 등 외부 HTTP 요청에 사용
 */
@Configuration
public class RestTemplateConfig {

	@Bean
	public RestTemplate restTemplate(RestTemplateBuilder builder) {
		return builder
			.connectTimeout(Duration.ofSeconds(5))   // 연결 timeout (Google API 권장)
			.readTimeout(Duration.ofSeconds(10))     // 읽기 timeout (OAuth 응답 대기)
			.build();
	}
}
