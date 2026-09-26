package uknowklp.secondbrain.global.config;

import java.io.IOException;
import java.util.function.Supplier;

import org.springframework.stereotype.Component;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.AccessToken;

@Component
public class GoogleCloudAuth {
	private static final String CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
	private final Supplier<GoogleCredentials> credentialsFactory;
	private GoogleCredentials credentials;

	public GoogleCloudAuth() {
		this(() -> {
			try {
				return GoogleCredentials.getApplicationDefault();
			} catch (IOException e) {
				throw new IllegalStateException("Google Cloud ADC를 읽을 수 없습니다", e);
			}
		});
	}

	GoogleCloudAuth(Supplier<GoogleCredentials> credentialsFactory) {
		this.credentialsFactory = credentialsFactory;
	}

	public synchronized String bearerToken() {
		if (credentials == null) {
			credentials = credentialsFactory.get().createScoped(CLOUD_PLATFORM_SCOPE);
		}
		try {
			credentials.refreshIfExpired();
			AccessToken token = credentials.getAccessToken();
			if (token == null || token.getTokenValue() == null || token.getTokenValue().isBlank()) {
				throw new IllegalStateException("Google Cloud ADC 액세스 토큰이 없습니다");
			}
			return token.getTokenValue();
		} catch (IOException e) {
			throw new IllegalStateException("Google Cloud ADC 토큰을 갱신할 수 없습니다", e);
		}
	}
}
