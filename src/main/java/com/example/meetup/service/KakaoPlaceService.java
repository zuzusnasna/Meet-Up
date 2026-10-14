package com.example.meetup.service;

import com.example.meetup.dto.KakaoPlaceResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class KakaoPlaceService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    @Value("${kakao.rest-api-key}")
    private String restApiKey;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RedisCacheService redisCacheService;

    public KakaoPlaceResponse searchPlace(String query) {
        String normalizedQuery = query == null ? "" : query.trim();
        String cacheKey = redisCacheService.versionedKey("kakao:place:keyword", normalizedQuery);
        KakaoPlaceResponse cached = redisCacheService.get(cacheKey, KakaoPlaceResponse.class);
        if (cached != null) return cached;

        KakaoPlaceResponse result = request("https://dapi.kakao.com/v2/local/search/keyword.json?query="
                + URLEncoder.encode(normalizedQuery, StandardCharsets.UTF_8), "Kakao API 호출 실패");
        redisCacheService.put(cacheKey, result, Duration.ofMinutes(10));
        return result;
    }

    public KakaoPlaceResponse searchNearbyRestaurants(double latitude, double longitude) {
        String cacheKey = redisCacheService.versionedKey(
                "kakao:restaurant", coordinate(latitude), coordinate(longitude));
        KakaoPlaceResponse cached = redisCacheService.get(cacheKey, KakaoPlaceResponse.class);
        if (cached != null) return cached;

        KakaoPlaceResponse result = request(
                "https://dapi.kakao.com/v2/local/search/category.json?category_group_code=FD6"
                        + "&x=" + longitude + "&y=" + latitude + "&radius=2000&sort=distance",
                "Kakao 맛집 API 호출 실패");
        redisCacheService.put(cacheKey, result, Duration.ofMinutes(10));
        return result;
    }

    public Map<String, Object> searchNearbySubwayStations(double latitude, double longitude) {
        String cacheKey = redisCacheService.versionedKey(
                "kakao:subway", coordinate(latitude), coordinate(longitude));
        Map<String, Object> cached = redisCacheService.get(cacheKey, MAP_TYPE);
        if (cached != null) return cached;

        int[] radii = {1000, 2000, 3000};
        for (int radius : radii) {
            KakaoPlaceResponse response = searchNearbyCategory(latitude, longitude, "SW8", radius);
            if (response.getDocuments() != null && !response.getDocuments().isEmpty()) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("radius", radius);
                result.put("documents", response.getDocuments());
                redisCacheService.put(cacheKey, result, Duration.ofHours(24));
                return result;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("radius", 3000);
        result.put("documents", Collections.emptyList());
        redisCacheService.put(cacheKey, result, Duration.ofHours(24));
        return result;
    }

    private KakaoPlaceResponse searchNearbyCategory(double latitude, double longitude, String categoryCode, int radius) {
        return request(
                "https://dapi.kakao.com/v2/local/search/category.json"
                        + "?category_group_code=" + categoryCode
                        + "&x=" + longitude + "&y=" + latitude
                        + "&radius=" + radius + "&sort=distance",
                "Kakao 카테고리 API 호출 실패");
    }

    private KakaoPlaceResponse request(String urlString, String errorPrefix) {
        HttpURLConnection connection = null;
        try {
            String apiKey = restApiKey == null ? "" : restApiKey.trim();
            connection = (HttpURLConnection) URI.create(urlString).toURL().openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Authorization", "KakaoAK " + apiKey);
            connection.setRequestProperty("Accept", "application/json");

            int statusCode = connection.getResponseCode();
            BufferedReader reader = new BufferedReader(new InputStreamReader(
                    statusCode >= 200 && statusCode < 300 ? connection.getInputStream() : connection.getErrorStream(),
                    StandardCharsets.UTF_8));
            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) response.append(line);
            reader.close();

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException(errorPrefix + ": HTTP " + statusCode + " - " + response);
            }
            return objectMapper.readValue(response.toString(), KakaoPlaceResponse.class);
        } catch (Exception e) {
            throw new RuntimeException(errorPrefix, e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String coordinate(double value) {
        return String.format(java.util.Locale.ROOT, "%.4f", value);
    }
}
