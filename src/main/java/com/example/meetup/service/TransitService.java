package com.example.meetup.service;

import com.example.meetup.dto.KakaoPlaceDto;
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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TransitService {

    @Value("${tour.api-key}")
    private String serviceKey;

    private final KakaoPlaceService kakaoPlaceService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> findLastTrain(
            double originLatitude,
            double originLongitude,
            double destinationLatitude,
            double destinationLongitude,
            String dayType
    ) {
        String normalizedDayType = normalizeDayType(dayType);

        KakaoPlaceDto originStation = nearestStation(originLatitude, originLongitude);
        KakaoPlaceDto destinationStation = nearestStation(destinationLatitude, destinationLongitude);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("originStation", stationSummary(originStation));
        result.put("destinationStation", stationSummary(destinationStation));
        result.put("dayType", normalizedDayType);

        if (originStation == null || destinationStation == null) {
            result.put("status", "STATION_NOT_FOUND");
            result.put("message", "출발지 또는 약속장소 주변 지하철역을 찾지 못했습니다.");
            result.put("lastDeparture", null);
            return result;
        }

        String destinationStationId = findTagoStationId(destinationStation.getPlaceName());
        if (destinationStationId == null) {
            result.put("status", "TAGO_STATION_NOT_FOUND");
            result.put("message", "TAGO 지하철 역 정보에서 약속장소 주변 역을 찾지 못했습니다. TAGO 역 검색 응답을 확인해야 합니다.");
            result.put("lastDeparture", null);
            return result;
        }

        String originName = normalizeStationName(originStation.getPlaceName());
        List<JsonNode> matchingSchedules = new ArrayList<>();
        for (String direction : List.of("U", "D")) {
            JsonNode schedules = fetchSchedules(destinationStationId, normalizedDayType, direction);
            for (JsonNode schedule : schedules) {
                String terminal = firstText(schedule,
                        "destinationStationName", "endStationName", "terminalStationName",
                        "arrivalStationName", "subwayStationName", "subwaystationname");
                if (!terminal.isBlank() && normalizeStationName(terminal).contains(originName)) {
                    matchingSchedules.add(schedule);
                }
            }
        }

        if (matchingSchedules.isEmpty()) {
            result.put("status", "DIRECT_ROUTE_NOT_FOUND");
            result.put("message", "직통으로 연결되는 시간표를 찾지 못했습니다. 현재 TAGO 데이터만으로는 환승 막차를 확정할 수 없습니다.");
            result.put("lastDeparture", null);
            return result;
        }

        JsonNode last = matchingSchedules.stream()
                .max(Comparator.comparing(this::scheduleTime))
                .orElse(null);

        result.put("status", "OK");
        result.put("message", "TAGO 시간표에서 확인한 직통 운행의 마지막 출발 후보입니다. 환승 경로를 포함한 최종 막차 보장은 아닙니다.");
        result.put("lastDeparture", last == null ? null : Map.of(
                "departureTime", firstText(last, "departureTime", "depTime", "startTime", "arrivalTime", "arrTime", "subwayArvlTime"),
                "destinationStationName", firstText(last, "destinationStationName", "endStationName", "terminalStationName", "arrivalStationName", "subwayStationName", "subwaystationname"),
                "routeName", firstText(last, "subwayRouteName", "routeName", "subwayroutename"),
                "direction", firstText(last, "upDownTypeCode", "upDownTypeName", "updowntypecode", "updowntypename")
        ));
        return result;
    }

    private KakaoPlaceDto nearestStation(double latitude, double longitude) {
        Map<String, Object> response = kakaoPlaceService.searchNearbySubwayStations(latitude, longitude);
        Object documents = response.get("documents");
        if (!(documents instanceof List<?> list) || list.isEmpty()) return null;
        Object first = list.get(0);
        return first instanceof KakaoPlaceDto dto ? dto : null;
    }

    private String findTagoStationId(String stationName) {
        String normalizedName = normalizeStationName(stationName);
        List<String> candidates = new ArrayList<>();
        addCandidate(candidates, stationName);
        addCandidate(candidates, normalizedName);
        addCandidate(candidates, stationName + "역");

        for (String candidate : candidates) {
            JsonNode root = requestJson(
                    "https://apis.data.go.kr/1613000/SubwayInfo/GetKwrdFndSubwaySttnList"
                            + "?serviceKey=" + encodedKey()
                            + "&subwayStationName=" + encode(candidate)
                            + "&pageNo=1&numOfRows=100&_type=json"
            );

            String stationId = findStationIdRecursively(root, normalizedName);
            if (stationId != null) return stationId;
        }
        return null;
    }

    /** TAGO 응답의 배열/객체 중첩 구조와 필드명 차이를 모두 처리한다. */
    private String findStationIdRecursively(JsonNode node, String normalizedTarget) {
        if (node == null || node.isNull()) return null;

        if (node.isObject()) {
            String name = firstText(node,
                    "subwayStationName", "stationName", "subwaystationname", "stationname");
            String id = firstText(node,
                    "subwayStationId", "stationId", "subwaystationid", "stationid");

            if (!name.isBlank() && !id.isBlank() && isSameStation(name, normalizedTarget)) {
                return id;
            }

            var fields = node.fields();
            while (fields.hasNext()) {
                JsonNode found = findStationIdRecursively(fields.next().getValue(), normalizedTarget);
                if (found != null) return found;
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                String found = findStationIdRecursively(child, normalizedTarget);
                if (found != null) return found;
            }
        }
        return null;
    }

    private boolean isSameStation(String name, String normalizedTarget) {
        if (name == null || name.isBlank() || normalizedTarget == null || normalizedTarget.isBlank()) return false;
        String normalized = normalizeStationName(name);
        return normalized.equals(normalizedTarget)
                || normalized.startsWith(normalizedTarget + "(")
                || normalized.startsWith(normalizedTarget + "[");
    }

    private void addCandidate(List<String> candidates, String value) {
        if (value != null && !value.isBlank() && !candidates.contains(value)) candidates.add(value);
    }

    private JsonNode fetchSchedules(String stationId, String dayType, String direction) {
        JsonNode root = requestJson(
                "https://apis.data.go.kr/1613000/SubwayInfo/GetSubwaySttnAcctoSchdulList"
                        + "?serviceKey=" + encodedKey()
                        + "&subwayStationId=" + encode(stationId)
                        + "&dailyTypeCode=" + dayType
                        + "&upDownTypeCode=" + direction
                        + "&pageNo=1&numOfRows=999&_type=json"
        );
        JsonNode items = root.path("response").path("body").path("items").path("item");
        if (items.isArray()) return items;
        if (items.isObject()) return objectMapper.createArrayNode().add(items);
        return objectMapper.createArrayNode();
    }

    private JsonNode requestJson(String url) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(),
                    StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("TAGO API HTTP " + status + " - " + body);
                }
                return objectMapper.readTree(body.toString());
            }
        } catch (Exception e) {
            throw new IllegalStateException("TAGO 지하철 API 요청에 실패했습니다. 인증키 승인 여부와 API 응답을 확인하세요.", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String normalizeDayType(String value) {
        if (value == null || value.isBlank()) {
            return switch (LocalDate.now().getDayOfWeek()) {
                case SATURDAY -> "02";
                case SUNDAY -> "03";
                default -> "01";
            };
        }
        return switch (value.toUpperCase(Locale.ROOT)) {
            case "WEEKDAY", "01" -> "01";
            case "SATURDAY", "02" -> "02";
            case "SUNDAY", "HOLIDAY", "03" -> "03";
            default -> throw new IllegalArgumentException("dayType은 01(평일), 02(토요일), 03(일/공휴일)만 가능합니다.");
        };
    }

    /** 이미 URL 인코딩된 공공데이터 서비스키를 다시 인코딩하지 않는다. */
    private String encodedKey() {
        String key = serviceKey == null ? "" : serviceKey.trim();
        if (key.contains("%2F") || key.contains("%3D") || key.contains("%2B") || key.contains("%25")) {
            return key;
        }
        return encode(key);
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? "" : value.asText();
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (!value.isBlank()) return value;
        }
        return "";
    }

    private String scheduleTime(JsonNode node) {
        return firstText(node, "departureTime", "depTime", "startTime", "arrivalTime", "arrTime", "subwayArvlTime")
                .replaceAll("[^0-9]", "");
    }

    private String normalizeStationName(String name) {
        return name == null ? "" : name.replace("역", "").replaceAll("\\s+", "").trim();
    }

    private Map<String, Object> stationSummary(KakaoPlaceDto station) {
        if (station == null) return null;
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("name", station.getPlaceName());
        summary.put("address", station.getRoadAddressName() == null || station.getRoadAddressName().isBlank()
                ? station.getAddressName() : station.getRoadAddressName());
        summary.put("latitude", station.getY());
        summary.put("longitude", station.getX());
        return summary;
    }
}
