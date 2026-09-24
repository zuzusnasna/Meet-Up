package com.example.meetup.service;

import com.example.meetup.dto.DirectionResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class DirectionService {

    @Value("${kakao.rest-api-key}")
    private String restApiKey;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public DirectionResponse getDirection(
            double originLatitude,
            double originLongitude,
            double destinationLatitude,
            double destinationLongitude
    ) {
        HttpURLConnection connection = null;

        try {
            String origin = originLongitude + "," + originLatitude;
            String destination = destinationLongitude + "," + destinationLatitude;

            String urlString =
                    "https://apis-navi.kakaomobility.com/v1/directions"
                    + "?origin=" + URLEncoder.encode(origin, StandardCharsets.UTF_8)
                    + "&destination=" + URLEncoder.encode(destination, StandardCharsets.UTF_8)
                    + "&priority=RECOMMEND"
                    + "&summary=true";

            connection = (HttpURLConnection) URI.create(urlString).toURL().openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Authorization", "KakaoAK " + restApiKey.trim());
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");

            int statusCode = connection.getResponseCode();

            BufferedReader reader = statusCode >= 200 && statusCode < 300
                    ? new BufferedReader(new InputStreamReader(
                            connection.getInputStream(), StandardCharsets.UTF_8))
                    : new BufferedReader(new InputStreamReader(
                            connection.getErrorStream(), StandardCharsets.UTF_8));

            StringBuilder response = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            reader.close();

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException(
                        "Kakao 길찾기 API 요청 실패: HTTP " + statusCode + " - " + response
                );
            }

            JsonNode root = objectMapper.readTree(response.toString());
            JsonNode route = root.path("routes").path(0);

            if (route.isMissingNode() || route.path("result_code").asInt(-1) != 0) {
                throw new RuntimeException(
                        "Kakao 길찾기 실패: " + route.path("result_msg").asText("알 수 없는 오류")
                );
            }

            JsonNode summary = route.path("summary");

            return new DirectionResponse(
                    summary.path("distance").asInt(),
                    summary.path("duration").asInt(),
                    summary.path("origin").path("name").asText(""),
                    summary.path("destination").path("name").asText("")
            );

        } catch (Exception e) {
            throw new RuntimeException("Kakao 길찾기 API 호출 실패", e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }
}
