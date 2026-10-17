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

    private static final System.Logger LOGGER = System.getLogger(LastTrainService.class.getName());
    private static final Duration STATION_CACHE_TTL = Duration.ofHours(24);
    private static final Duration SCHEDULE_CACHE_TTL = Duration.ofHours(6);
    private static final TypeReference<List<Map<String, String>>> STATION_TYPE = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> SCHEDULE_TYPE = new TypeReference<>() {};

    @Value("${tago.service-key:}") private String serviceKey;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RedisCacheService redisCacheService;

    public Map<String, Object> findLastTrainForRoute(List<Map<String, Object>> segments) {
        LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] lookup start segments=" + summarizeSegments(segments));
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> subwaySegment = segments == null ? null : segments.stream().filter(segment -> "SUBWAY".equalsIgnoreCase(String.valueOf(segment.get("type")))).findFirst().orElse(null);
        if (subwaySegment == null) return failure("NO_SUBWAY_SEGMENT", "지하철이 포함되지 않은 경로입니다.");
        Object stopsValue = subwaySegment.get("stops");
        if (!(stopsValue instanceof List<?> stops) || stops.size() < 2) return failure("INVALID_SUBWAY_SEGMENT", "지하철 역 정보를 확인할 수 없습니다.");
        String stationName = String.valueOf(stops.get(0)).trim();
        String routeText = vehicleText(subwaySegment.get("vehicles"));
        LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] segment station=" + stationName + " stops=" + stops + " routeText=" + routeText);
        if (stationName.isBlank()) return failure("INVALID_SUBWAY_SEGMENT", "지하철 승차역을 확인할 수 없습니다.");
        if (serviceKey == null || serviceKey.isBlank()) return failure("SERVICE_KEY_MISSING", "TAGO_SERVICE_KEY 설정이 없어 막차 시간표를 조회할 수 없습니다.");
        String dayType = todayDayType();
        List<Map<String, String>> stations = findStations(stationName);
        LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] station lookup count=" + stations.size() + " data=" + stations);
        String requestedLine = subwayLineNumber(normalize(routeText));
        if (!requestedLine.isBlank() && !stations.isEmpty()) {
            List<Map<String, String>> matchingStations = stations.stream().filter(station -> { String stationLine = subwayLineNumber(normalize(station.getOrDefault("routeName", ""))); return stationLine.isBlank() || requestedLine.equals(stationLine); }).toList();
            LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] line filter requestedLine=" + requestedLine + " before=" + stations.size() + " after=" + matchingStations.size());
            if (!matchingStations.isEmpty()) stations = matchingStations;
        }
        if (stations.isEmpty()) return failure("STATION_NOT_FOUND", "지하철 역의 TAGO 정보를 찾지 못했습니다.");
        List<Map<String, Object>> candidates = new ArrayList<>();
        for (Map<String, String> station : stations) {
            String stationId = station.get("id"), routeName = station.getOrDefault("routeName", "");
            for (String direction : List.of("U", "D")) {
                List<Map<String, Object>> schedules = findSchedules(stationId, dayType, direction);
                LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] schedules stationId=" + stationId + " route=" + routeName + " dayType=" + dayType + " direction=" + direction + " count=" + schedules.size());
                int invalidTime = 0, routeMismatch = 0;
                for (Map<String, Object> schedule : schedules) {
                    String rawTime = firstText(schedule, "depTime", "departureTime", "lastTrainTime", "trainTime", "arrtime", "arrTime", "subwayArrivalTime", "subwayTime", "arrivalTime");
                    String time = normalizeTime(rawTime);
                    if (!isValidTime(time)) { invalidTime++; continue; }
                    String scheduleRoute = firstText(schedule, "subwayRouteName", "subwayRouteNm", "routeName", "routeNm");
                    if (!routeMatches(routeText, scheduleRoute, routeName)) { routeMismatch++; continue; }
                    Map<String, Object> candidate = new LinkedHashMap<>(schedule);
                    candidate.put("departureTime", time); candidate.put("displayTime", displayTime(time)); candidate.put("stationName", stationName); candidate.put("routeName", scheduleRoute.isBlank() ? routeName : scheduleRoute); candidate.put("direction", firstText(schedule, "upDownTypeCode", "upDownTypeName"));
                    candidates.add(candidate);
                }
                LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] filtered stationId=" + stationId + " direction=" + direction + " invalidTime=" + invalidTime + " routeMismatch=" + routeMismatch + " candidatesTotal=" + candidates.size());
            }
        }
        LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] candidate count=" + candidates.size());
        Map<String, Object> last = candidates.stream().max(Comparator.comparingInt(item -> timeToMinutes(String.valueOf(item.get("departureTime"))))).orElse(null);
        if (last == null) return failure("SCHEDULE_NOT_FOUND", "이 경로의 지하철 막차 시간표를 찾지 못했습니다.");
        result.put("status", "OK"); result.put("message", "이 경로의 첫 지하철 승차역 기준 막차입니다."); result.put("lastDeparture", last);
        LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] success station=" + stationName + " departure=" + last.get("departureTime") + " display=" + last.get("displayTime"));
        return result;
    }

    private Map<String, Object> failure(String status, String message) {
        LOGGER.log(System.Logger.Level.WARNING, "[LAST_TRAIN] status=" + status + " message=" + message);
        Map<String, Object> result = new LinkedHashMap<>(); result.put("status", status); result.put("message", message); result.put("lastDeparture", null); return result;
    }

    private List<Map<String, String>> findStations(String stationName) {
        String key = redisCacheService.versionedKey("transit:station", normalize(stationName));
        List<Map<String, String>> cached = redisCacheService.get(key, STATION_TYPE);
        if (cached != null) { LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] station cache hit key=" + key); return cached; }
        JsonNode root = requestJson("https://apis.data.go.kr/1613000/SubwayInfo/GetKwrdFndSubwaySttnList?serviceKey=" + encodedKey() + "&subwayStationName=" + encode(stationName) + "&pageNo=1&numOfRows=100&_type=json");
        List<Map<String, String>> stations = new ArrayList<>(); JsonNode items = root.path("response").path("body").path("items").path("item");
        if (items.isObject()) items = objectMapper.createArrayNode().add(items);
        if (items.isArray()) for (JsonNode item : items) { String name = firstText(item, "subwayStationName", "subwayStationNm", "subwaystationname", "stationName"); if (!normalize(name).equals(normalize(stationName))) continue; Map<String, String> station = new LinkedHashMap<>(); station.put("id", firstText(item, "subwayStationId", "subwaystationid", "stationId")); station.put("routeName", firstText(item, "subwayRouteName", "subwayroutename", "subwayRouteNm", "routeName")); if (!station.get("id").isBlank()) stations.add(station); }
        if (!stations.isEmpty()) redisCacheService.put(key, stations, STATION_CACHE_TTL); return stations;
    }

    private List<Map<String, Object>> findSchedules(String stationId, String dayType, String direction) {
        String key = redisCacheService.versionedKey("transit:lasttrain", stationId, dayType, direction); List<Map<String, Object>> cached = redisCacheService.get(key, SCHEDULE_TYPE);
        if (cached != null) { LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] schedule cache hit key=" + key); return cached; }
        JsonNode root = requestJson("https://apis.data.go.kr/1613000/SubwayInfo/GetSubwaySttnAcctoSchdulList?serviceKey=" + encodedKey() + "&subwayStationId=" + encode(stationId) + "&dailyTypeCode=" + encode(dayType) + "&upDownTypeCode=" + encode(direction) + "&pageNo=1&numOfRows=999&_type=json");
        List<Map<String, Object>> schedules = new ArrayList<>(); JsonNode items = root.path("response").path("body").path("items").path("item");
        if (items.isObject()) items = objectMapper.createArrayNode().add(items); if (items.isArray()) for (JsonNode item : items) schedules.add(objectMapper.convertValue(item, new TypeReference<Map<String, Object>>() {}));
        if (!schedules.isEmpty()) redisCacheService.put(key, schedules, SCHEDULE_CACHE_TTL); return schedules;
    }

    private String todayDayType() { return switch (LocalDate.now().getDayOfWeek()) { case SATURDAY -> "02"; case SUNDAY -> "03"; default -> "01"; }; }
    private boolean routeMatches(String vehicleText, String scheduleRoute, String stationRoute) { if (vehicleText == null || vehicleText.isBlank()) return true; String target = normalize(vehicleText), schedule = normalize(scheduleRoute), station = normalize(stationRoute); String targetLine = subwayLineNumber(target), scheduleLine = subwayLineNumber(schedule), stationLine = subwayLineNumber(station); if (!targetLine.isBlank()) { if (!scheduleLine.isBlank()) return targetLine.equals(scheduleLine); if (!stationLine.isBlank()) return targetLine.equals(stationLine); } return (!schedule.isBlank() && (target.contains(schedule) || schedule.contains(target))) || (!station.isBlank() && (target.contains(station) || station.contains(target))) || (schedule.isBlank() && station.isBlank()); }
    private String subwayLineNumber(String value) { if (value == null || value.isBlank()) return ""; java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d{1,2})호선").matcher(value); return matcher.find() ? matcher.group(1) : ""; }
    private String normalizeTime(String value) { if (value == null) return ""; String digits = value.trim().replaceAll("[^0-9]", ""); if (digits.matches("\\d{4}")) return digits + "00"; if (digits.matches("\\d{6}")) return digits; return ""; }
    private String vehicleText(Object vehicles) { if (!(vehicles instanceof List<?> list)) return ""; return list.stream().map(String::valueOf).reduce("", (a, b) -> a + " " + b); }
    private boolean isValidTime(String value) { return value != null && value.matches("\\d{6}") && !value.equals("000000"); }
    private int timeToMinutes(String value) { if (!isValidTime(value)) return -1; int hour = Integer.parseInt(value.substring(0, 2)); int minute = Integer.parseInt(value.substring(2, 4)); if (hour < 4) hour += 24; return hour * 60 + minute; }
    private String displayTime(String value) { int hour = Integer.parseInt(value.substring(0, 2)); String minute = value.substring(2, 4); if (hour >= 24) return String.format("익일 %02d:%s", hour - 24, minute); if (hour < 4) return String.format("익일 %02d:%s", hour, minute); return String.format("%02d:%s", hour, minute); }
    private String normalize(String value) { return value == null ? "" : value.replace("역", "").replaceAll("\\s+", "").trim(); }
    private String firstText(JsonNode node, String... fields) { for (String field : fields) { JsonNode value = node == null ? null : node.get(field); if (value != null && !value.isNull() && !value.asText().isBlank()) return value.asText(); } return ""; }
    private String firstText(Map<String, Object> node, String... fields) { for (String field : fields) { Object value = node.get(field); if (value != null && !String.valueOf(value).isBlank()) return String.valueOf(value); } return ""; }

    private JsonNode requestJson(String url) {
        HttpURLConnection connection = null;
        try {
            String safeUrl = url.replaceFirst("([?&]serviceKey=)[^&]*", "$1[hidden]"); LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] TAGO request=" + safeUrl);
            connection = (HttpURLConnection) URI.create(url).toURL().openConnection(); connection.setRequestMethod("GET"); connection.setConnectTimeout(5000); connection.setReadTimeout(10000); connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(), StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder(); String line; while ((line = reader.readLine()) != null) body.append(line);
                LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] TAGO response HTTP=" + status + " bodyLength=" + body.length());
                if (status < 200 || status >= 300) throw new IllegalStateException("TAGO subway API HTTP " + status + " - " + body);
                JsonNode response = objectMapper.readTree(body.toString()); String resultCode = response.path("response").path("header").path("resultCode").asText(""); String resultMsg = response.path("response").path("header").path("resultMsg").asText("");
                LOGGER.log(System.Logger.Level.INFO, "[LAST_TRAIN] TAGO resultCode=" + resultCode + " resultMsg=" + resultMsg); return response;
            }
        } catch (Exception e) {
            LOGGER.log(System.Logger.Level.ERROR, "[LAST_TRAIN] TAGO request failed: " + e.getClass().getSimpleName() + " - " + e.getMessage(), e);
            throw new IllegalStateException("TAGO 지하철 시간표 API 호출에 실패했습니다.", e);
        } finally { if (connection != null) connection.disconnect(); }
    }

    private String summarizeSegments(List<Map<String, Object>> segments) { if (segments == null) return "null"; return segments.stream().map(s -> String.valueOf(s.get("type")) + ":" + String.valueOf(s.get("stops")) + ":" + String.valueOf(s.get("vehicles"))).toList().toString(); }
    private String encodedKey() { String key = serviceKey == null ? "" : serviceKey.trim(); return key.matches(".*%[0-9A-Fa-f]{2}.*") ? key : encode(key); }
    private String encode(String value) { return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8); }
}
