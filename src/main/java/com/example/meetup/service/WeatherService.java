package com.example.meetup.service;

import com.example.meetup.dto.WeatherResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class WeatherService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RedisCacheService redisCacheService;

    public WeatherResponse getCurrentWeather(double latitude, double longitude) {
        String cacheKey = "weather:current:" + coordinate(latitude) + ":" + coordinate(longitude);
        WeatherResponse cached = redisCacheService.get(cacheKey, WeatherResponse.class);
        if (cached != null) return cached;

        HttpURLConnection connection = null;
        try {
            String urlString = "https://api.open-meteo.com/v1/forecast"
                    + "?latitude=" + URLEncoder.encode(String.valueOf(latitude), StandardCharsets.UTF_8)
                    + "&longitude=" + URLEncoder.encode(String.valueOf(longitude), StandardCharsets.UTF_8)
                    + "&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m"
                    + "&timezone=Asia%2FSeoul";

            connection = (HttpURLConnection) URI.create(urlString).toURL().openConnection();
            connection.setRequestMethod("GET");
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
                throw new RuntimeException("Weather API 요청 실패: HTTP " + statusCode + " - " + response);
            }

            WeatherResponse result = objectMapper.readValue(response.toString(), WeatherResponse.class);
            redisCacheService.put(cacheKey, result, Duration.ofMinutes(10));
            return result;
        } catch (Exception e) {
            throw new RuntimeException("Weather API 호출 실패", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String coordinate(double value) {
        return String.format(Locale.ROOT, "%.2f", value);
    }
}
