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
import java.util.Iterator;
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

    public Map<String, Object> findLastTrain(double originLatitude, double originLongitude,
                                             double destinationLatitude, double destinationLongitude,
                                             String dayType) {
        String normalizedDayType = normalizeDayType(dayType);
        KakaoPlaceDto originStation = nearestStation(originLatitude, originLongitude);
        KakaoPlaceDto destinationStation = nearestStation(destinationLatitude, destinationLongitude);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("originStation", stationSummary(originStation));
        result.put("destinationStation", stationSummary(destinationStation));
        result.put("dayType", normalizedDayType);

        if (originStation == null || destinationStation == null) {
            return failure(result, "STATION_NOT_FOUND", "출발지 또는 약속장소 주변 지하철역을 찾지 못했습니다.");
        }

        String originStationId = findTagoStationId(originStation.getPlaceName());
        String destinationStationId = findTagoStationId(destinationStation.getPlaceName());
        if (originStationId == null || destinationStationId == null) {
            return failure(result, "TAGO_STATION_NOT_FOUND", "주변 역을 TAGO 지하철 역 정보와 연결하지 못했습니다.");
        }

        String destinationName = normalizeStationName(destinationStation.getPlaceName());
        List<JsonNode> matchingSchedules = new ArrayList<>();

        // TAGO 시간표는 '해당 역에서 출발하는 열차' 기준이므로
        // 출발지 역의 시간표를 조회한 뒤 종착역이 목적지 역과 일치하는 직통 후보만 추립니다.
        for (String direction : List.of("U", "D")) {
            JsonNode schedules = fetchSchedules(originStationId, normalizedDayType, direction);
            for (JsonNode schedule : schedules) {
                String terminal = firstText(schedule,
                        "endsubwaystationnm", "endSubwayStationNm",
                        "destinationStationName", "endStationName", "terminalStationName",
                        "arrivalStationName", "subwayStationName");
                if (!terminal.isBlank() && isSameStation(terminal, destinationName)) {
                    matchingSchedules.add(schedule);
                }
            }
        }

        if (matchingSchedules.isEmpty()) {
            return failure(result, "DIRECT_ROUTE_NOT_FOUND",
                    "출발지 역에서 약속장소 역으로 바로 가는 TAGO 시간표를 찾지 못했습니다. 환승 경로는 별도 경로 검색이 필요합니다.");
        }

        JsonNode last = matchingSchedules.stream()
                .filter(schedule -> !scheduleTime(schedule).equals("000000"))
                .max(Comparator.comparing(this::scheduleTime))
                .orElse(null);

        if (last == null) {
            return failure(result, "SCHEDULE_NOT_FOUND", "막차 시간표를 찾지 못했습니다.");
        }

        Map<String, Object> lastDeparture = new LinkedHashMap<>();
        lastDeparture.put("departureTime", firstText(last,
                "arrtime", "arrivalTime", "arrTime", "departureTime", "depTime", "startTime"));
        lastDeparture.put("destinationStationName", firstText(last,
                "endsubwaystationnm", "endSubwayStationNm",
                "destinationStationName", "endStationName", "terminalStationName",
                "arrivalStationName", "subwayStationName"));
        lastDeparture.put("routeName", firstText(last, "subwayRouteName", "routeName"));
        lastDeparture.put("direction", firstText(last, "upDownTypeCode", "upDownTypeName"));

        result.put("status", "OK");
        result.put("message", "TAGO 시간표에서 확인한 직통 운행의 마지막 출발 후보입니다. 환승 경로를 포함한 최종 막차 보장은 아닙니다.");
        result.put("lastDeparture", lastDeparture);
        return result;
    }

    private Map<String, Object> failure(Map<String, Object> result, String status, String message) {
        result.put("status", status);
        result.put("message", message);
        result.put("lastDeparture", null);
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
        addCandidate(candidates, normalizedName + "역");

        for (String candidate : candidates) {
            JsonNode root = requestJson(
                    "https://apis.data.go.kr/1613000/SubwayInfo/GetKwrdFndSubwaySttnList"
                            + "?serviceKey=" + encodedKey()
                            + "&subwayStationName=" + encode(candidate)
                            + "&pageNo=1&numOfRows=100&_type=json"
            );

            String stationId = findStationId(root, normalizedName);
            if (stationId != null) return stationId;
        }
        return null;
    }

    private String findStationId(JsonNode node, String target) {
        if (node == null || node.isNull()) return null;

        if (node.isObject()) {
            // TAGO JSON의 실제 필드는 subwayStationID(대문자 ID)다.
            String name = firstText(node, "subwayStationName", "stationName", "subwaystationname", "stationname");
            String id = firstText(node, "subwayStationID", "subwayStationId", "stationId", "subwaystationid", "stationid");
            if (!name.isBlank() && !id.isBlank() && isSameStation(name, target)) return id;

            Iterator<JsonNode> values = node.elements();
            while (values.hasNext()) {
                String found = findStationId(values.next(), target);
                if (found != null) return found;
            }
            return null;
        }

        if (node.isArray()) {
            for (JsonNode child : node) {
                String found = findStationId(child, target);
                if (found != null) return found;
            }
        }
        return null;
    }

    private boolean isSameStation(String name, String target) {
        String normalized = normalizeStationName(name);
        return !normalized.isBlank() && !target.isBlank()
                && (normalized.equals(target)
                || normalized.startsWith(target + "(")
                || normalized.startsWith(target + "[")
                || target.startsWith(normalized + "(")
                || target.startsWith(normalized + "[")
                || normalized.contains(target)
                || target.contains(normalized));
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
                if (status < 200 || status >= 300) throw new IllegalStateException("TAGO API HTTP " + status + " - " + body);
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

    private String encodedKey() {
        String key = serviceKey == null ? "" : serviceKey.trim();
        return key.matches(".*%[0-9A-Fa-f]{2}.*") ? key : encode(key);
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
        String value = firstText(node, "arrtime", "arrivalTime", "arrTime", "departureTime", "depTime", "startTime");
        String digits = value.replaceAll("[^0-9]", "");
        return digits.isBlank() ? "000000" : digits;
    }

    private String normalizeStationName(String name) {
        if (name == null) return "";
        return name
                .replaceAll("\\([^)]*\\)", "")
                .replaceAll("\\[[^]]*\\]", "")
                .replaceAll("\\s*(공항철도|경의중앙선|경춘선|수인분당선|분당선|신분당선|우이신설선|의정부경전철|김포골드라인|서해선|1호선|2호선|3호선|4호선|5호선|6호선|7호선|8호선|9호선)\\s*", "")
                .replace("역", "")
                .replaceAll("\\s+", "")
                .trim();
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
