package uknowklp.secondbrain.global.config;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;
import org.springframework.util.StringUtils;

@Configuration
@EnableElasticsearchRepositories(basePackages = "uknowklp.secondbrain.api.note.repository")
public class ElasticsearchConfig extends ElasticsearchConfiguration {

	@Value("${spring.elasticsearch.uris}")
	private String uris;

	@Value("${spring.elasticsearch.username:}")
	private String username;

	@Value("${spring.elasticsearch.password:}")
	private String password;

	@Override
	public ClientConfiguration clientConfiguration() {
		// 인증 정보가 있는 경우
		if (StringUtils.hasText(username) && StringUtils.hasText(password)) {
			return ClientConfiguration.builder()
				.connectedTo(uris)
				// 원격 TLS는 JVM trust store의 인증서와 호스트 이름을 검증합니다.
				.usingSsl()
				.withBasicAuth(username, password)
				.build();
		}

		// 인증 정보가 없는 경우
		return ClientConfiguration.builder()
			.connectedTo(uris)
			.build();
	}

}
