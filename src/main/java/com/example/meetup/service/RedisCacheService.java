package com.example.meetup.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

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

    /**
     * 한 번 조회한 데이터는 TTL 없이 Redis에 유지한다.
     * 현재 프로젝트에서는 방이 존재하는 동안 같은 조회를 반복하지 않도록
     * 캐시 만료보다 명시적인 삭제를 우선한다.
     *
     * ttl 인자는 기존 호출부 호환을 위해 유지하지만 더 이상 만료시간에 사용하지 않는다.
     */
    public void put(String key, Object value, java.time.Duration ignoredTtl) {
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(value));
        } catch (Exception ignored) {
            // Redis가 일시적으로 unavailable이어도 원본 API 조회는 계속 수행한다.
        }
    }
}
