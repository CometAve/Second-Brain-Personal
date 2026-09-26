package uknowklp.secondbrain.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Date;
import java.util.List;

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.GoogleCredentials;
import org.junit.jupiter.api.Test;

class GoogleCloudAuthTest {
	@Test
	void scopesAndRefreshesCredentialsForEachRequest() throws Exception {
		var source = mock(GoogleCredentials.class);
		var scoped = mock(GoogleCredentials.class);
		when(source.createScoped("https://www.googleapis.com/auth/cloud-platform")).thenReturn(scoped);
		doReturn(new AccessToken("first", new Date(System.currentTimeMillis() + 3600000)),
			new AccessToken("second", new Date(System.currentTimeMillis() + 3600000)))
			.when(scoped).getAccessToken();
		var auth = new GoogleCloudAuth(() -> source);
		assertThat(List.of(auth.bearerToken(), auth.bearerToken())).containsExactly("first", "second");
		verify(scoped, times(2)).refreshIfExpired();
		verify(source).createScoped("https://www.googleapis.com/auth/cloud-platform");
	}
}
