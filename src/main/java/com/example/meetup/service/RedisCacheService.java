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

    private static final String CACHE_VERSION = "v2";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public <T> T get(String key, TypeReference<T> type) {
        try {
            String value = redisTemplate.opsForValue().get(key);
            if (value == null || value.isBlank()) return null;
            return objectMapper.readValue(value, type);
        } catch (Exception e) {
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

    public String versionedKey(String namespace, Object... components) {
        StringBuilder source = new StringBuilder(CACHE_VERSION);
        for (Object component : components) {
            String value = component == null ? "" : String.valueOf(component);
            source.append('|').append(value.length()).append(':').append(value);
        }
        return namespace + ":" + CACHE_VERSION + ":" + sha256(source.toString());
    }

    public void put(String key, Object value, Duration ignoredTtl) {
        try {
            if (value == null) return;
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(value));
        } catch (Exception ignored) {
        }
    }

    public void delete(String key) {
        try {
            redisTemplate.delete(key);
        } catch (Exception ignored) {
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
