package uknowklp.secondbrain.global.config;

import java.time.Duration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;

import io.netty.channel.ChannelOption;
import reactor.netty.http.client.HttpClient;

@Configuration
public class GeminiConfig {
	@Bean
	public WebClient geminiWebClient() {
		HttpClient client = HttpClient.create()
			.option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000)
			.responseTimeout(Duration.ofSeconds(30));
		return WebClient.builder().clientConnector(new ReactorClientHttpConnector(client)).build();
	}
}
