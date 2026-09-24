package com.example.meetup.service;

import com.example.meetup.dto.KakaoPlaceDto;
import com.example.meetup.dto.KakaoPlaceResponse;
import com.example.meetup.dto.TourismItemDto;
import com.example.meetup.dto.TourismResponseDto;
import com.fasterxml.jackson.databind.JsonNode;
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
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TourismService {

    @Value("${tour.api-key}")
    private String tourApiKey;

    private final KakaoPlaceService kakaoPlaceService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TourismResponseDto searchNearby(
            double latitude,
            double longitude,
            String category
    ) {
        if ("RESTAURANT".equalsIgnoreCase(category)) {
            return searchRestaurants(latitude, longitude);
        }

        int contentTypeId = switch (category.toUpperCase()) {
            case "EVENT" -> 15;
            case "TOURIST" -> 12;
            default -> throw new IllegalArgumentException(
                    "지원하지 않는 카테고리입니다: " + category
            );
        };

        return searchTourApi(latitude, longitude, category.toUpperCase(), contentTypeId);
    }

    private TourismResponseDto searchTourApi(
            double latitude,
            double longitude,
            String category,
            int contentTypeId
    ) {
        HttpURLConnection connection = null;

        try {
            String encodedKey = URLEncoder.encode(
                    tourApiKey.trim(),
                    StandardCharsets.UTF_8
            );

            String urlString =
                    "https://apis.data.go.kr/B551011/KorService2/locationBasedList2"
                            + "?serviceKey=" + encodedKey
                            + "&MobileOS=ETC"
                            + "&MobileApp=MeetUp"
                            + "&_type=json"
                            + "&numOfRows=10"
                            + "&pageNo=1"
                            + "&mapX=" + longitude
                            + "&mapY=" + latitude
                            + "&radius=2000"
                            + "&contentTypeId=" + contentTypeId;

            connection = (HttpURLConnection)
                    URI.create(urlString).toURL().openConnection();

            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/json");

            int statusCode = connection.getResponseCode();
            String responseBody = readResponse(connection, statusCode);

            if (statusCode < 200 || statusCode >= 300) {
                throw new RuntimeException(
                        "TourAPI 요청 실패: HTTP " + statusCode + " - " + responseBody
                );
            }

            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode itemNode = root
                    .path("response")
                    .path("body")
                    .path("items")
                    .path("item");

            List<TourismItemDto> items = new ArrayList<>();

            if (itemNode.isArray()) {
                for (JsonNode item : itemNode) {
                    items.add(toTourismItem(item));
                }
            } else if (itemNode.isObject()) {
                items.add(toTourismItem(itemNode));
            }

            return TourismResponseDto.builder()
                    .category(category)
                    .items(items)
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("TourAPI 호출 실패", e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private TourismItemDto toTourismItem(JsonNode item) {
        return TourismItemDto.builder()
                .contentId(text(item, "contentid"))
                .title(text(item, "title"))
                .address(text(item, "addr1"))
                .imageUrl(text(item, "firstimage"))
                .latitude(text(item, "mapy"))
                .longitude(text(item, "mapx"))
                .phone(text(item, "tel"))
                .startDate(text(item, "eventstartdate"))
                .endDate(text(item, "eventenddate"))
                .placeUrl(
                        "https://map.kakao.com/link/map/"
                                + encode(text(item, "title"))
                                + ","
                                + text(item, "mapy")
                                + ","
                                + text(item, "mapx")
                )
                .build();
    }

    private TourismResponseDto searchRestaurants(
            double latitude,
            double longitude
    ) {
        try {
            KakaoPlaceResponse response =
                    kakaoPlaceService.searchNearbyRestaurants(latitude, longitude);

            List<TourismItemDto> items = new ArrayList<>();

            if (response.getDocuments() != null) {
                for (KakaoPlaceDto place : response.getDocuments()) {
                    items.add(TourismItemDto.builder()
                            .contentId(place.getId())
                            .title(place.getPlaceName())
                            .address(place.getRoadAddressName() != null
                                    && !place.getRoadAddressName().isBlank()
                                    ? place.getRoadAddressName()
                                    : place.getAddressName())
                            .latitude(place.getY())
                            .longitude(place.getX())
                            .phone(place.getPhone())
                            .placeUrl(place.getPlaceUrl())
                            .build());
                }
            }

            return TourismResponseDto.builder()
                    .category("RESTAURANT")
                    .items(items)
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("주변 맛집 조회 실패", e);
        }
    }

    private String readResponse(
            HttpURLConnection connection,
            int statusCode
    ) throws Exception {
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
        return response.toString();
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? "" : value.asText();
    }

    private String encode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return value;
        }
    }
}
