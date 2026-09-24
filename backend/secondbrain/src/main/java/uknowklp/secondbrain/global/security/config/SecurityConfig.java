package uknowklp.secondbrain.global.security.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import uknowklp.secondbrain.global.security.filter.JwtAuthenticationFilter;
import uknowklp.secondbrain.global.security.handler.OAuth2AuthenticationFailureHandler;
import uknowklp.secondbrain.global.security.handler.OAuth2LoginSuccessHandler;
import uknowklp.secondbrain.global.security.oauth2.service.CustomOAuth2UserService;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

	// OAuth2 관련 컴포넌트
	private final CustomOAuth2UserService customOAuth2UserService;
	private final OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;
	private final OAuth2AuthenticationFailureHandler oAuth2AuthenticationFailureHandler;

	// JWT 인증 필터
	private final JwtAuthenticationFilter jwtAuthenticationFilter;

	// CORS 허용 출처 (환경변수로 override 가능)
	@Value("${security.cors.allowed-origins:}")
	private List<String> allowedOrigins;

	@Bean
	public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
		http
			// CORS 설정
			.cors(cors -> cors.configurationSource(corsConfigurationSource()))
			// CSRF 비활성화 (JWT 사용)
			.csrf(csrf -> csrf.disable())
			// 폼 로그인, HTTP Basic 비활성화
			.formLogin(form -> form.disable())
			.httpBasic(httpBasic -> httpBasic.disable())
			// 세션 관리 STATELESS 설정
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

			// 요청별 접근 권한 설정 (Path-based Authorization)
			.authorizeHttpRequests(authorize -> authorize
				// 공개 엔드포인트 (인증 불필요)
				.requestMatchers("/", "/error", "/favicon.ico", "/health").permitAll()
				.requestMatchers("/oauth2/**", "/login/**").permitAll()
				.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll() // CORS Preflight

				// WebSocket 엔드포인트 (인증 불필요 - STOMP에서 JWT 검증)
				.requestMatchers("/ws/**").permitAll()

				// Swagger UI (인증 불필요)
				.requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()

				// 인증 API (인증 불필요)
				.requestMatchers(HttpMethod.POST, "/api/auth/token").permitAll()
				.requestMatchers(HttpMethod.POST, "/api/auth/refresh").permitAll()
				.requestMatchers(HttpMethod.POST, "/api/auth/token/google").permitAll()
				.requestMatchers(HttpMethod.POST, "/api/auth/google").permitAll() // 웹 Google 로그인

				// TTS API (인증 불필요 - 개발 환경)
				// TODO: 프로덕션 배포 시 인증 추가
				.requestMatchers("/api/tts/**").permitAll()

				// AI API (인증 불필요 - 개발 환경)
				// TODO: 프로덕션 배포 시 인증 추가
				.requestMatchers("/ai/api/v1/**").permitAll()

				// MCP API (API Key 기반 인증 - 별도 검증)
				.requestMatchers("/api/apikey/validate").permitAll() // API Key 검증 API
				.requestMatchers("/api/mcp/**").permitAll() // MCP용 Note API

				// 보호된 엔드포인트 (인증 필수)
				.requestMatchers("/api/**").authenticated()

				// 나머지 모든 요청은 인증 필요
				.anyRequest().authenticated()
			)

			// OAuth2 로그인 설정
			.oauth2Login(oauth2 -> oauth2
				.userInfoEndpoint(userInfo -> userInfo
					.userService(customOAuth2UserService))
				.successHandler(oAuth2LoginSuccessHandler)
				.failureHandler(oAuth2AuthenticationFailureHandler))

			// JWT 인증 필터 추가
			.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

		return http.build();
	}

	// CORS 설정 Bean
	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();

		// 로컬 확장 프로그램은 현재 웹페이지 origin을 사용하므로 패턴 설정을 지원합니다.
		configuration.setAllowedOriginPatterns(allowedOrigins);

		// 허용 헤더
		configuration.setAllowedHeaders(Arrays.asList("*"));

		// 허용 HTTP 메소드 (OPTIONS 명시적 포함)
		configuration.setAllowedMethods(Arrays.asList(
			"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"
		));

		// 자격 증명(쿠키, Authorization 헤더) 허용
		configuration.setAllowCredentials(true);

		// 노출할 응답 헤더 (클라이언트에서 접근 가능)
		configuration.setExposedHeaders(Arrays.asList("Authorization"));

		// Preflight 캐싱 시간 (1시간)
		configuration.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}
}
