package com.example.meetup.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;

@Service
@RequiredArgsConstructor
public class RedisCacheService {

    private static final String CACHE_VERSION = "v1";

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
     * 입력값으로 캐시 버전을 만든다.
     * 출발지, 검색어, 목적지 등의 입력이 바뀌면 다른 버전 키가 생성되어
     * 기존 캐시를 재사용하지 않고 원본 API를 다시 조회한다.
     */
    public String versionedKey(String namespace, Object... components) {
        StringBuilder source = new StringBuilder(CACHE_VERSION);
        for (Object component : components) {
            String value = component == null ? "" : String.valueOf(component);
            source.append('|').append(value.length()).append(':').append(value);
        }
        return namespace + ":" + CACHE_VERSION + ":" + sha256(source.toString());
    }

    /**
     * 한 번 조회한 데이터는 TTL 없이 Redis에 유지한다.
     * 현재 프로젝트에서는 동일한 입력에 대해 외부 API를 반복 호출하지 않고,
     * 입력값이 바뀌면 versionedKey가 달라져 새 데이터를 조회한다.
     *
     * ttl 인자는 기존 호출부 호환을 위해 유지하지만 더 이상 만료시간에 사용하지 않는다.
     */
    public void put(String key, Object value, Duration ignoredTtl) {
        try {
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(value));
        } catch (Exception ignored) {
            // Redis가 일시적으로 unavailable이어도 원본 API 조회는 계속 수행한다.
        }
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(hash.length * 2);
            for (byte b : hash) result.append(String.format("%02x", b));
            return result.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", e);
        }
    }
}
