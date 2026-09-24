package com.example.meetup.config;

import com.example.meetup.service.CustomOAuth2UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.web.SecurityFilterChain;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final ClientRegistrationRepository clientRegistrationRepository;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())

                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/kakao/**",
                                "/api/place-candidates/**",
                                "/api/votes/**",
                                "/api/weather/**",
                                "/api/locations/**",
                                "/api/tourism/**",
                                "/api/memos/**",
                                "/api/rooms/**",
                                "/api/users/**",
                                "/api/auth/logout",
                                "/api/auth/logout/kakao",
                                "/api/auth/logout/kakao/callback",
                                "/api/auth/logout/naver",
                                "/api/auth/logout/google",
                                "/oauth2/**",
                                "/login/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )

                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(authorization -> authorization
                                .authorizationRequestResolver(
                                        authorizationRequestResolver()
                                )
                        )
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(customOAuth2UserService)
                        )
                        .defaultSuccessUrl("http://localhost:5173/", true)
                );

        return http.build();
    }

    /**
     * Google은 로그인할 때 select_account를 지정하여
     * 기존 계정으로 자동 진입하지 않고 계정 선택 화면을 보여준다.
     */
    @Bean
    public OAuth2AuthorizationRequestResolver authorizationRequestResolver() {
        DefaultOAuth2AuthorizationRequestResolver defaultResolver =
                new DefaultOAuth2AuthorizationRequestResolver(
                        clientRegistrationRepository,
                        "/oauth2/authorization"
                );

        return new OAuth2AuthorizationRequestResolver() {

            @Override
            public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
                return customize(
                        defaultResolver.resolve(request),
                        request
                );
            }

            @Override
            public OAuth2AuthorizationRequest resolve(
                    HttpServletRequest request,
                    String registrationId
            ) {
                return customize(
                        defaultResolver.resolve(request, registrationId),
                        request
                );
            }

            private OAuth2AuthorizationRequest customize(
                    OAuth2AuthorizationRequest authorizationRequest,
                    HttpServletRequest request
            ) {
                if (authorizationRequest == null) {
                    return null;
                }

                String registrationId =
                        request.getRequestURI()
                                .substring(request.getRequestURI().lastIndexOf("/") + 1);

                if (!"google".equals(registrationId)) {
                    return authorizationRequest;
                }

                Map<String, Object> additionalParameters =
                        new HashMap<>(authorizationRequest.getAdditionalParameters());

                additionalParameters.put("prompt", "select_account");

                return OAuth2AuthorizationRequest
                        .from(authorizationRequest)
                        .additionalParameters(additionalParameters)
                        .build();
            }
        };
    }
}
