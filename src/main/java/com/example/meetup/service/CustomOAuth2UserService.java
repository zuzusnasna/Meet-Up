package com.example.meetup.service;

import com.example.meetup.entity.User;
import com.example.meetup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) {
        OAuth2User oauth2User = super.loadUser(userRequest);

        String provider = userRequest.getClientRegistration().getRegistrationId();
        Map<String, Object> attributes = oauth2User.getAttributes();

        String socialId = extractSocialId(provider, attributes);
        String name = extractName(provider, attributes);
        String email = extractEmail(provider, attributes);

        User user = userRepository
                .findBySocialIdAndProvider(socialId, provider)
                .map(existing -> {
                    existing.setName(name);
                    existing.setEmail(email);
                    existing.setUpdatedAt(LocalDateTime.now());
                    return existing;
                })
                .orElseGet(() -> User.builder()
                        .socialId(socialId)
                        .provider(provider)
                        .name(name)
                        .email(email)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());

        userRepository.saveAndFlush(user);

        return oauth2User;
    }

    private String extractSocialId(String provider, Map<String, Object> attributes) {
        if ("kakao".equals(provider)) {
            return String.valueOf(attributes.get("id"));
        }

        if ("naver".equals(provider)) {
            Map<String, Object> response = (Map<String, Object>) attributes.get("response");
            return String.valueOf(response.get("id"));
        }

        if ("google".equals(provider)) {
            return String.valueOf(attributes.get("sub"));
        }

        throw new IllegalArgumentException("지원하지 않는 소셜 로그인 제공자입니다: " + provider);
    }

    private String extractName(String provider, Map<String, Object> attributes) {
        if ("kakao".equals(provider)) {
            Map<String, Object> account = (Map<String, Object>) attributes.get("kakao_account");
            if (account != null) {
                Map<String, Object> profile = (Map<String, Object>) account.get("profile");
                if (profile != null && profile.get("nickname") != null) {
                    return String.valueOf(profile.get("nickname"));
                }
            }
        }

        if ("naver".equals(provider)) {
            Map<String, Object> response = (Map<String, Object>) attributes.get("response");
            return response.get("name") == null ? null : String.valueOf(response.get("name"));
        }

        if ("google".equals(provider)) {
            return attributes.get("name") == null ? null : String.valueOf(attributes.get("name"));
        }

        return null;
    }

    private String extractEmail(String provider, Map<String, Object> attributes) {
        if ("kakao".equals(provider)) {
            Map<String, Object> account = (Map<String, Object>) attributes.get("kakao_account");
            return account == null || account.get("email") == null
                    ? null
                    : String.valueOf(account.get("email"));
        }

        if ("naver".equals(provider)) {
            Map<String, Object> response = (Map<String, Object>) attributes.get("response");
            return response.get("email") == null ? null : String.valueOf(response.get("email"));
        }

        if ("google".equals(provider)) {
            return attributes.get("email") == null ? null : String.valueOf(attributes.get("email"));
        }

        return null;
    }
}
