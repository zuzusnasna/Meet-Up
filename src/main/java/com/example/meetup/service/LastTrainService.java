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

        if (serviceKey == null || serviceKey.isBlank()) {
            result.put("status", "SERVICE_KEY_MISSING");
            result.put("message", "TAGO_SERVICE_KEY 설정이 없어 막차 시간표를 조회할 수 없습니다.");
            result.put("lastDeparture", null);
            return result;
        }

        String dayType = todayDayType();
        List<Map<String, String>> stations = findStations(stationName);
        // 같은 이름의 역이 여러 노선에 존재하면 요청 노선과 맞는 역부터 조회해
        // 불필요한 시간표 API 호출을 줄인다.
        String requestedLine = subwayLineNumber(normalize(routeText));
        if (!requestedLine.isBlank() && !stations.isEmpty()) {
            List<Map<String, String>> matchingStations = stations.stream()
                    .filter(station -> {
                        String stationLine = subwayLineNumber(normalize(station.getOrDefault("routeName", "")));
                        return stationLine.isBlank() || requestedLine.equals(stationLine);
                    })
                    .toList();
            if (!matchingStations.isEmpty()) stations = matchingStations;
        }
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
                    String time = normalizeTime(firstText(schedule,
                        "arrtime", "arrTime", "subwayArrivalTime", "subwayTime",
                        "arrivalTime", "depTime", "departureTime", "lastTrainTime", "trainTime"));
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
        String key = redisCacheService.versionedKey("transit:station", normalize(stationName));
        List<Map<String, String>> cached = redisCacheService.get(key, STATION_TYPE);
        if (cached != null) return cached;

        JsonNode root = requestJson(
                "https://apis.data.go.kr/1613000/SubwayInfo/GetKwrdFndSubwaySttnList"
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

        // API 키 오류나 일시적인 API 응답으로 빈 결과가 나와도 장시간 캐시하지 않는다.
        if (!stations.isEmpty()) redisCacheService.put(key, stations, STATION_CACHE_TTL);
        return stations;
    }

    private List<Map<String, Object>> findSchedules(String stationId, String dayType, String direction) {
        String key = redisCacheService.versionedKey("transit:lasttrain", stationId, dayType, direction);
        List<Map<String, Object>> cached = redisCacheService.get(key, SCHEDULE_TYPE);
        if (cached != null) return cached;

        JsonNode root = requestJson(
                "https://apis.data.go.kr/1613000/SubwayInfo/GetSubwaySttnAcctoSchdulList"
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

        // 시간표가 비어 있는 응답은 재조회할 수 있도록 캐시하지 않는다.
        if (!schedules.isEmpty()) redisCacheService.put(key, schedules, SCHEDULE_CACHE_TTL);
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
        String schedule = normalize(scheduleRoute);
        String station = normalize(stationRoute);

        // 노선 API마다 "2호선" / "수도권2호선"처럼 표기가 다를 수 있어,
        // 노선 번호가 명확하면 번호를 우선 비교한다.
        String targetLine = subwayLineNumber(target);
        String scheduleLine = subwayLineNumber(schedule);
        String stationLine = subwayLineNumber(station);
        if (!targetLine.isBlank()) {
            if (!scheduleLine.isBlank()) return targetLine.equals(scheduleLine);
            if (!stationLine.isBlank()) return targetLine.equals(stationLine);
        }

        return (!schedule.isBlank() && (target.contains(schedule) || schedule.contains(target)))
                || (!station.isBlank() && (target.contains(station) || station.contains(target)))
                || (schedule.isBlank() && station.isBlank());
    }

    private String subwayLineNumber(String value) {
        if (value == null || value.isBlank()) return "";
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("(\\d{1,2})호선").matcher(value);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String normalizeTime(String value) {
        if (value == null) return "";
        String digits = value.trim().replaceAll("[^0-9]", "");
        if (digits.matches("\\d{4}")) return digits + "00";
        if (digits.matches("\\d{6}")) return digits;
        return "";
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
