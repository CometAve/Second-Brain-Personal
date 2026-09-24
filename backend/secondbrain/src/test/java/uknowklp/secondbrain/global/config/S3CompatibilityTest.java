package uknowklp.secondbrain.global.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Collections;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import io.awspring.cloud.autoconfigure.core.CredentialsProviderAutoConfiguration;
import io.awspring.cloud.autoconfigure.core.AwsAutoConfiguration;
import io.awspring.cloud.autoconfigure.core.RegionProviderAutoConfiguration;
import io.awspring.cloud.autoconfigure.s3.S3AutoConfiguration;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.core.sync.RequestBody;

class S3CompatibilityTest {
	@Test
	void awsAutoConfigurationCreatesAndUsesS3ClientWithLatestBootAndSdk() throws Exception {
		var requests = Collections.synchronizedList(new ArrayList<String>());
		var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.createContext("/", exchange -> {
			requests.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath());
			exchange.getRequestBody().readAllBytes();
			exchange.sendResponseHeaders(200, -1);
			exchange.close();
		});
		server.start();
		try {
			new ApplicationContextRunner()
				.withConfiguration(AutoConfigurations.of(AwsAutoConfiguration.class, CredentialsProviderAutoConfiguration.class,
					RegionProviderAutoConfiguration.class, S3AutoConfiguration.class))
				.withPropertyValues("spring.cloud.aws.credentials.access-key=local-test",
					"spring.cloud.aws.credentials.secret-key=local-test",
					"spring.cloud.aws.region.static=ap-northeast-2",
					"spring.cloud.aws.s3.endpoint=http://127.0.0.1:" + server.getAddress().getPort(),
					"spring.cloud.aws.s3.path-style-access-enabled=true")
				.run(context -> {
					assertThat(context).hasNotFailed().hasSingleBean(S3Client.class);
					var client = context.getBean(S3Client.class);
					client.putObject(request -> request.bucket("local-bucket").key("test.txt"), RequestBody.fromString("local-test"));
					client.deleteObject(request -> request.bucket("local-bucket").key("test.txt"));
				});
			assertThat(requests).containsExactly("PUT /local-bucket/test.txt", "DELETE /local-bucket/test.txt");
		} finally {
			server.stop(0);
		}
	}
}
