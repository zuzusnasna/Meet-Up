package com.example.meetup.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
@RequiredArgsConstructor
public class RedisCacheService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public <T> T get(String key, TypeReference<T> type) {
        try {
            String value = redisTemplate.opsForValue().get(key);
            if (value == null || value.isBlank()) return null;
            return objectMapper.readValue(value, type);
        } catch (Exception e) {
            // 캐시는 보조 저장소이므로 Redis 장애가 원본 API 장애로 전파되지 않게 한다.
            return null;
        }
    }

    public <T> T get(String key, Class<T> type) {
        try {
            String value = redisTemplate.opsForValue().get(key);
            if (value == null || value.isBlank()) return null;
            return objectMapper.readValue(value, type);
        } catch (Exception e) {
            return null;
        }
    }

    public void put(String key, Object value, Duration ttl) {
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(value), ttl);
        } catch (Exception ignored) {
            // Redis가 일시적으로 unavailable이어도 원본 API 조회는 계속 수행한다.
        }
    }
}
