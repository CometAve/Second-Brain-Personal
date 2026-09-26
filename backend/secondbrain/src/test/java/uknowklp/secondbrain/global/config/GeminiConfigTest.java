package uknowklp.secondbrain.global.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

import uknowklp.secondbrain.api.gms.service.GeminiClient;

class GeminiConfigTest {
	@Test
	void wiresGeminiClientWithoutAWebClientBuilderBeanOrAdcAtStartup() {
		try (var context = new AnnotationConfigApplicationContext()) {
			context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", Map.of(
				"gemini.base-url", "http://127.0.0.1:9",
				"gemini.project", "test-project",
				"gemini.location", "global",
				"gemini.embedding-model", "gemini-embedding-2",
				"gemini.generation-model", "gemini-3.8-flash"
			)));
			context.register(GeminiConfig.class, GoogleCloudAuth.class, GeminiClient.class);
			context.refresh();
			assertThat(context.getBean(GeminiClient.class)).isNotNull();
			assertThat(context.getBeansOfType(WebClient.Builder.class)).isEmpty();
		}
	}
}
