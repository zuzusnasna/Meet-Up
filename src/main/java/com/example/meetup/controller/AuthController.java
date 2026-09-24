package com.example.meetup.controller;

import com.example.meetup.entity.User;
import com.example.meetup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;

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
