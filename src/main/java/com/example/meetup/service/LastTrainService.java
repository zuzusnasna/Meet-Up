package com.example.meetup.service;

import com.fasterxml.jackson.core.type.TypeReference;
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
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LastTrainService {

    private static final Duration STATION_CACHE_TTL = Duration.ofHours(24);
    private static final Duration SCHEDULE_CACHE_TTL = Duration.ofHours(6);
    private static final TypeReference<List<Map<String, String>>> STATION_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> SCHEDULE_TYPE = new TypeReference<>() {};

    @Value("${tago.service-key:}")
    private String serviceKey;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RedisCacheService redisCacheService;

    public Map<String, Object> findLastTrainForRoute(List<Map<String, Object>> segments) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> subwaySegment = segments == null ? null : segments.stream()
                .filter(segment -> "SUBWAY".equalsIgnoreCase(String.valueOf(segment.get("type"))))
                .findFirst().orElse(null);

        if (subwaySegment == null) {
            result.put("status", "NO_SUBWAY_SEGMENT");
            result.put("message", "지하철이 포함되지 않은 경로입니다.");
            result.put("lastDeparture", null);
            return result;
        }

        Object stopsValue = subwaySegment.get("stops");
        if (!(stopsValue instanceof List<?> stops) || stops.size() < 2) {
            result.put("status", "INVALID_SUBWAY_SEGMENT");
            result.put("message", "지하철 역 정보를 확인할 수 없습니다.");
            result.put("lastDeparture", null);
            return result;
        }

        String stationName = String.valueOf(stops.get(0)).trim();
        String routeText = vehicleText(subwaySegment.get("vehicles"));
        if (stationName.isBlank()) {
            result.put("status", "INVALID_SUBWAY_SEGMENT");
            result.put("message", "지하철 승차역을 확인할 수 없습니다.");
            result.put("lastDeparture", null);
            return result;
        }

        String dayType = todayDayType();
        List<Map<String, String>> stations = findStations(stationName);
        if (stations.isEmpty()) {
            result.put("status", "STATION_NOT_FOUND");
            result.put("message", "지하철 역의 TAGO 정보를 찾지 못했습니다.");
            result.put("lastDeparture", null);
            return result;
        }

        List<Map<String, Object>> candidates = new ArrayList<>();
        for (Map<String, String> station : stations) {
            String stationId = station.get("id");
            String routeName = station.getOrDefault("routeName", "");
            for (String direction : List.of("U", "D")) {
                for (Map<String, Object> schedule : findSchedules(stationId, dayType, direction)) {
                    String time = firstText(schedule, "arrtime", "subwayArrivalTime", "subwayTime", "arrivalTime", "depTime", "departureTime");
                    if (!isValidTime(time)) continue;
                    String scheduleRoute = firstText(schedule, "subwayRouteName", "subwayRouteNm", "routeName", "routeNm");
                    if (!routeMatches(routeText, scheduleRoute, routeName)) continue;

                    Map<String, Object> candidate = new LinkedHashMap<>(schedule);
                    candidate.put("departureTime", time);
                    candidate.put("stationName", stationName);
                    candidate.put("routeName", scheduleRoute.isBlank() ? routeName : scheduleRoute);
                    candidate.put("direction", firstText(schedule, "upDownTypeCode", "upDownTypeName"));
                    candidates.add(candidate);
                }
            }
        }

        Map<String, Object> last = candidates.stream()
                .max(Comparator.comparingInt(item -> timeToMinutes(String.valueOf(item.get("departureTime")))))
                .orElse(null);

        if (last == null) {
            result.put("status", "SCHEDULE_NOT_FOUND");
            result.put("message", "이 경로의 지하철 막차 시간표를 찾지 못했습니다.");
            result.put("lastDeparture", null);
            return result;
        }

        result.put("status", "OK");
        result.put("message", "이 경로의 첫 지하철 승차역 기준 막차입니다.");
        result.put("lastDeparture", last);
        return result;
    }

    private List<Map<String, String>> findStations(String stationName) {
        String key = "transit:station:" + normalize(stationName);
        List<Map<String, String>> cached = redisCacheService.get(key, STATION_TYPE);
        if (cached != null) return cached;

        JsonNode root = requestJson(
                "https://apis.data.go.kr/1613000/SubwayInfo/getKwrdFndSubwaySttnList"
                        + "?serviceKey=" + encodedKey()
                        + "&subwayStationName=" + encode(stationName)
                        + "&pageNo=1&numOfRows=100&_type=json");

        List<Map<String, String>> stations = new ArrayList<>();
        JsonNode items = root.path("response").path("body").path("items").path("item");
        if (items.isObject()) items = objectMapper.createArrayNode().add(items);
        if (items.isArray()) {
            for (JsonNode item : items) {
                String name = firstText(item, "subwayStationName", "subwayStationNm", "subwaystationname", "stationName");
                if (!normalize(name).equals(normalize(stationName))) continue;
                Map<String, String> station = new LinkedHashMap<>();
                station.put("id", firstText(item, "subwayStationId", "subwaystationid", "stationId"));
                station.put("routeName", firstText(item, "subwayRouteName", "subwayroutename", "subwayRouteNm", "routeName"));
                if (!station.get("id").isBlank()) stations.add(station);
            }
        }

        redisCacheService.put(key, stations, STATION_CACHE_TTL);
        return stations;
    }

    private List<Map<String, Object>> findSchedules(String stationId, String dayType, String direction) {
        String key = "transit:lasttrain:" + stationId + ":" + dayType + ":" + direction;
        List<Map<String, Object>> cached = redisCacheService.get(key, SCHEDULE_TYPE);
        if (cached != null) return cached;

        JsonNode root = requestJson(
                "https://apis.data.go.kr/1613000/SubwayInfo/getSubwaySttnAcctoSchdulList"
                        + "?serviceKey=" + encodedKey()
                        + "&subwayStationId=" + encode(stationId)
                        + "&dailyTypeCode=" + encode(dayType)
                        + "&upDownTypeCode=" + encode(direction)
                        + "&pageNo=1&numOfRows=999&_type=json");

        List<Map<String, Object>> schedules = new ArrayList<>();
        JsonNode items = root.path("response").path("body").path("items").path("item");
        if (items.isObject()) items = objectMapper.createArrayNode().add(items);
        if (items.isArray()) {
            for (JsonNode item : items) schedules.add(objectMapper.convertValue(item, new TypeReference<Map<String, Object>>() {}));
        }

        redisCacheService.put(key, schedules, SCHEDULE_CACHE_TTL);
        return schedules;
    }

    private String todayDayType() {
        return switch (LocalDate.now().getDayOfWeek()) {
            case SATURDAY -> "02";
            case SUNDAY -> "03";
            default -> "01";
        };
    }

    private boolean routeMatches(String vehicleText, String scheduleRoute, String stationRoute) {
        if (vehicleText == null || vehicleText.isBlank()) return true;
        String target = normalize(vehicleText);
        if (!scheduleRoute.isBlank() && target.contains(normalize(scheduleRoute))) return true;
        if (!stationRoute.isBlank() && target.contains(normalize(stationRoute))) return true;
        return scheduleRoute.isBlank() && stationRoute.isBlank();
    }

    private String vehicleText(Object vehicles) {
        if (!(vehicles instanceof List<?> list)) return "";
        return list.stream().map(String::valueOf).reduce("", (a, b) -> a + " " + b);
    }

    private boolean isValidTime(String value) {
        return value != null && value.matches("\\d{6}") && !value.equals("000000");
    }

    private int timeToMinutes(String value) {
        if (!isValidTime(value)) return -1;
        return Integer.parseInt(value.substring(0, 2)) * 60 + Integer.parseInt(value.substring(2, 4));
    }

    private String normalize(String value) {
        return value == null ? "" : value.replace("역", "").replaceAll("\\s+", "").trim();
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = node == null ? null : node.get(field);
            if (value != null && !value.isNull() && !value.asText().isBlank()) return value.asText();
        }
        return "";
    }

    private String firstText(Map<String, Object> node, String... fields) {
        for (String field : fields) {
            Object value = node.get(field);
            if (value != null && !String.valueOf(value).isBlank()) return String.valueOf(value);
        }
        return "";
    }

    private JsonNode requestJson(String url) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(), StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
                if (status < 200 || status >= 300) throw new IllegalStateException("TAGO subway API HTTP " + status + " - " + body);
                return objectMapper.readTree(body.toString());
            }
        } catch (Exception e) {
            throw new IllegalStateException("TAGO 지하철 시간표 API 호출에 실패했습니다.", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String encodedKey() {
        String key = serviceKey == null ? "" : serviceKey.trim();
        return key.matches(".*%[0-9A-Fa-f]{2}.*") ? key : encode(key);
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
