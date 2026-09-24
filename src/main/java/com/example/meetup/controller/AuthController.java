package com.example.meetup.controller;

import com.example.meetup.entity.User;
import com.example.meetup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final OAuth2AuthorizedClientService authorizedClientService;

    @Value("${kakao.rest-api-key}")
    private String kakaoRestApiKey;

    @Value("${NAVER_CLIENT_ID}")
    private String naverClientId;

    @Value("${NAVER_CLIENT_SECRET}")
    private String naverClientSecret;

    @GetMapping("/logout")
    public void logout(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {

        if (authentication instanceof OAuth2AuthenticationToken oauth2Token) {
            String provider = oauth2Token.getAuthorizedClientRegistrationId();

            if ("kakao".equals(provider)) {
                response.sendRedirect(
                        "https://kauth.kakao.com/oauth/logout"
                                + "?client_id=" + urlEncode(kakaoRestApiKey)
                                + "&logout_redirect_uri="
                                + urlEncode("http://localhost:8080/api/auth/logout/kakao/callback")
                );
                return;
            }

            if ("naver".equals(provider)) {
                revokeNaverToken(oauth2Token);
            }

            if ("google".equals(provider)) {
                revokeGoogleToken(oauth2Token);
            }
        }

        logoutLocal(request, response);
    }

    /**
     * 카카오계정 + Meet-Up 로그아웃 후 호출되는 콜백
     */
    @GetMapping("/logout/kakao/callback")
    public void kakaoLogoutCallback(
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        logoutLocal(request, response);
    }

    /**
     * 네이버는 공식적으로 '네이버 계정 로그아웃 API'를 제공하지 않는다.
     * 대신 Meet-Up에 발급된 OAuth 토큰을 폐기하고 Meet-Up 세션을 종료한다.
     */
    @GetMapping("/logout/naver")
    public void naverLogout(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {
        if (authentication instanceof OAuth2AuthenticationToken oauth2Token) {
            revokeNaverToken(oauth2Token);
        }

        logoutLocal(request, response);
    }

    /**
     * Google OAuth 토큰을 폐기하고 Meet-Up 세션을 종료한다.
     */
    @GetMapping("/logout/google")
    public void googleLogout(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException {
        if (authentication instanceof OAuth2AuthenticationToken oauth2Token) {
            revokeGoogleToken(oauth2Token);
        }

        logoutLocal(request, response);
    }

    private void revokeNaverToken(OAuth2AuthenticationToken authentication) {
        OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                "naver",
                authentication.getName()
        );

        if (client == null || client.getAccessToken() == null) {
            return;
        }

        try {
            String form = "client_id=" + urlEncode(naverClientId)
                    + "&client_secret=" + urlEncode(naverClientSecret)
                    + "&token=" + urlEncode(client.getAccessToken().getTokenValue())
                    + "&token_type_hint=access_token";

            postForm("https://nid.naver.com/oauth2.0/revoke", form);
        } catch (Exception e) {
            System.err.println("Naver OAuth token revoke failed: " + e.getMessage());
        }
    }

    private void revokeGoogleToken(OAuth2AuthenticationToken authentication) {
        OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(
                "google",
                authentication.getName()
        );

        if (client == null || client.getAccessToken() == null) {
            return;
        }

        try {
            String form = "token=" + urlEncode(client.getAccessToken().getTokenValue());
            postForm("https://oauth2.googleapis.com/revoke", form);
        } catch (Exception e) {
            System.err.println("Google OAuth token revoke failed: " + e.getMessage());
        }
    }

    private void postForm(String url, String form) throws IOException {
        HttpURLConnection connection =
                (HttpURLConnection) URI.create(url).toURL().openConnection();

        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty(
                "Content-Type",
                "application/x-www-form-urlencoded;charset=UTF-8"
        );

        byte[] body = form.getBytes(StandardCharsets.UTF_8);
        connection.getOutputStream().write(body);

        int responseCode = connection.getResponseCode();

        if (responseCode < 200 || responseCode >= 300) {
            throw new IOException("HTTP " + responseCode);
        }

        connection.disconnect();
    }

    private void logoutLocal(
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        new SecurityContextLogoutHandler().logout(request, response, null);
        response.sendRedirect("http://localhost:5173/");
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @GetMapping("/me")
    public User me(Authentication authentication) {
        if (!(authentication instanceof OAuth2AuthenticationToken oauth2AuthenticationToken)) {
            throw new IllegalStateException("로그인이 필요합니다.");
        }

        String provider = oauth2AuthenticationToken
                .getAuthorizedClientRegistrationId();

        Map<String, Object> attributes =
                oauth2AuthenticationToken.getPrincipal().getAttributes();

        String socialId;

        if ("kakao".equals(provider)) {
            socialId = String.valueOf(attributes.get("id"));
        } else if ("naver".equals(provider)) {
            Map<String, Object> response =
                    (Map<String, Object>) attributes.get("response");
            socialId = String.valueOf(response.get("id"));
        } else if ("google".equals(provider)) {
            socialId = String.valueOf(attributes.get("sub"));
        } else {
            throw new IllegalArgumentException("지원하지 않는 로그인 제공자입니다.");
        }

        return userRepository
                .findBySocialIdAndProvider(socialId, provider)
                .orElseThrow(() -> new IllegalStateException("로그인 사용자를 찾을 수 없습니다."));
    }
}
