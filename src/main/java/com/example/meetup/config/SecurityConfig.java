package com.example.meetup.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

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
                                "/api/memos/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                );

        return http.build();
    }
}
