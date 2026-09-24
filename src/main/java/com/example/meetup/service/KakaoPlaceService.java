package com.example.meetup.service;

import com.example.meetup.dto.KakaoPlaceResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class KakaoPlaceService {

    @Value("${kakao.rest-api-key}")
    private String restApiKey;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public KakaoPlaceResponse searchPlace(String query) {

        HttpURLConnection connection = null;

        try {
            String apiKey = restApiKey == null ? "" : restApiKey.trim();

            String encodedQuery =
                    URLEncoder.encode(query, StandardCharsets.UTF_8);

            String urlString =
                    "https://dapi.kakao.com/v2/local/search/keyword.json?query="
                            + encodedQuery;

            connection = (HttpURLConnection)
                    URI.create(urlString).toURL().openConnection();

            connection.setRequestMethod("GET");

            connection.setRequestProperty(
                    "Authorization",
                    "KakaoAK " + apiKey
            );

            connection.setRequestProperty(
                    "Accept",
                    "application/json"
            );

            int statusCode = connection.getResponseCode();

            BufferedReader reader;

            if (statusCode >= 200 && statusCode < 300) {
                reader = new BufferedReader(
                        new InputStreamReader(
                                connection.getInputStream(),
                                StandardCharsets.UTF_8
                        )
                );
            } else {
                reader = new BufferedReader(
                        new InputStreamReader(
                                connection.getErrorStream(),
                                StandardCharsets.UTF_8
                        )
                );
            }

            StringBuilder response = new StringBuilder();

            String line;

            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            reader.close();

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException(
                        "Kakao API 요청 실패: HTTP "
                                + statusCode
                                + " - "
                                + response
                );
            }

            return objectMapper.readValue(
                    response.toString(),
                    KakaoPlaceResponse.class
            );

        } catch (Exception e) {
            throw new RuntimeException("Kakao API 호출 실패", e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    public KakaoPlaceResponse searchNearbyRestaurants(
            double latitude,
            double longitude
    ) {
        HttpURLConnection connection = null;

        try {
            String apiKey = restApiKey == null ? "" : restApiKey.trim();

            String urlString =
                    "https://dapi.kakao.com/v2/local/search/category.json"
                            + "?category_group_code=FD6"
                            + "&x=" + longitude
                            + "&y=" + latitude
                            + "&radius=2000"
                            + "&sort=distance";

            connection = (HttpURLConnection)
                    URI.create(urlString).toURL().openConnection();

            connection.setRequestMethod("GET");
            connection.setRequestProperty(
                    "Authorization",
                    "KakaoAK " + apiKey
            );
            connection.setRequestProperty(
                    "Accept",
                    "application/json"
            );

            int statusCode = connection.getResponseCode();

            BufferedReader reader;

            if (statusCode >= 200 && statusCode < 300) {
                reader = new BufferedReader(
                        new InputStreamReader(
                                connection.getInputStream(),
                                StandardCharsets.UTF_8
                        )
                );
            } else {
                reader = new BufferedReader(
                        new InputStreamReader(
                                connection.getErrorStream(),
                                StandardCharsets.UTF_8
                        )
                );
            }

            StringBuilder response = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            reader.close();

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException(
                        "Kakao 맛집 API 요청 실패: HTTP "
                                + statusCode
                                + " - "
                                + response
                );
            }

            return objectMapper.readValue(
                    response.toString(),
                    KakaoPlaceResponse.class
            );

        } catch (Exception e) {
            throw new RuntimeException("Kakao 맛집 API 호출 실패", e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }
    public Map<String, Object> searchNearbySubwayStations(double latitude, double longitude) {
        int[] radii = {1000, 2000, 3000};

        for (int radius : radii) {
            KakaoPlaceResponse response = searchNearbyCategory(latitude, longitude, "SW8", radius);

            if (response.getDocuments() != null && !response.getDocuments().isEmpty()) {
                Map<String, Object> result = new LinkedHashMap<>();
                result.put("radius", radius);
                result.put("documents", response.getDocuments());
                return result;
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("radius", 3000);
        result.put("documents", java.util.Collections.emptyList());
        return result;
    }

    private KakaoPlaceResponse searchNearbyCategory(
            double latitude,
            double longitude,
            String categoryCode,
            int radius
    ) {
        HttpURLConnection connection = null;

        try {
            String apiKey = restApiKey == null ? "" : restApiKey.trim();

            String urlString =
                    "https://dapi.kakao.com/v2/local/search/category.json"
                            + "?category_group_code=" + categoryCode
                            + "&x=" + longitude
                            + "&y=" + latitude
                            + "&radius=" + radius
                            + "&sort=distance";

            connection = (HttpURLConnection)
                    URI.create(urlString).toURL().openConnection();

            connection.setRequestMethod("GET");
            connection.setRequestProperty("Authorization", "KakaoAK " + apiKey);
            connection.setRequestProperty("Accept", "application/json");

            int statusCode = connection.getResponseCode();

            BufferedReader reader = new BufferedReader(
                    new InputStreamReader(
                            statusCode >= 200 && statusCode < 300
                                    ? connection.getInputStream()
                                    : connection.getErrorStream(),
                            StandardCharsets.UTF_8
                    )
            );

            StringBuilder response = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                response.append(line);
            }
            reader.close();

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException(
                        "Kakao 카테고리 API 요청 실패: HTTP "
                                + statusCode + " - " + response
                );
            }

            return objectMapper.readValue(response.toString(), KakaoPlaceResponse.class);

        } catch (Exception e) {
            throw new RuntimeException("Kakao 카테고리 API 호출 실패", e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

}
