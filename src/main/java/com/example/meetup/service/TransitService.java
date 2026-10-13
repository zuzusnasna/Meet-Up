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
        List<KakaoPlaceDto> originNearby = nearbyStations(originLatitude, originLongitude);
        List<KakaoPlaceDto> destinationNearby = nearbyStations(destinationLatitude, destinationLongitude);
        List<TagoStation> originStations = resolveTagoStations(originNearby);
        List<TagoStation> destinationStations = resolveTagoStations(destinationNearby);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("originStation", stationSummary(originNearby.isEmpty() ? null : originNearby.get(0)));
        result.put("destinationStation", stationSummary(destinationNearby.isEmpty() ? null : destinationNearby.get(0)));
        result.put("originStationCandidates", originStations.stream().map(this::tagoStationSummary).toList());
        result.put("destinationStationCandidates", destinationStations.stream().map(this::tagoStationSummary).toList());
        result.put("dayType", normalizedDayType);

        if (originStations.isEmpty() || destinationStations.isEmpty()) {
            return failure(result, "STATION_NOT_FOUND",
                    "출발지 또는 약속장소 주변 역의 호선별 TAGO 정보를 찾지 못했습니다.");
        }

        List<ScheduleMatch> matchingSchedules = new ArrayList<>();

        // 같은 역명이라도 호선별 TAGO 역 ID가 다를 수 있으므로,
        // 목적지 후보의 시간표를 한 번씩 조회하고 출발지 호선 후보와 대조한다.
        for (TagoStation destination : destinationStations) {
            for (String direction : List.of("U", "D")) {
                JsonNode schedules = fetchSchedules(destination.id(), normalizedDayType, direction);
                for (JsonNode schedule : schedules) {
                    String terminal = firstText(schedule,
                            "endsubwaystationnm", "endSubwayStationNm",
                            "destinationStationName", "endStationName", "terminalStationName",
                            "arrivalStationName", "subwayStationName");
                    String scheduleRoute = firstText(schedule,
                            "subwayRouteName", "subwayRouteNm", "routeName", "routeNm");
                    if (!scheduleRoute.isBlank() && !sameRoute(scheduleRoute, destination.routeName())) continue;

                    for (TagoStation origin : originStations) {
                        if (!sameRoute(destination.routeName(), origin.routeName())) continue;
                        if (isSameStation(terminal, origin.name())) {
                            matchingSchedules.add(new ScheduleMatch(schedule, origin, destination));
                        }
                    }
                }
            }
        }

        if (matchingSchedules.isEmpty()) {
            return failure(result, "DIRECT_ROUTE_NOT_FOUND",
                    "출발지·목적지의 호선별 시간표에서 직통 운행을 찾지 못했습니다. 환승 경로는 아직 계산하지 않습니다.");
        }

        ScheduleMatch lastMatch = matchingSchedules.stream()
                .filter(match -> !scheduleTime(match.schedule()).equals("000000"))
                .max(Comparator.comparing(match -> scheduleTime(match.schedule())))
                .orElse(null);

        if (lastMatch == null) {
            return failure(result, "SCHEDULE_NOT_FOUND", "호선별 시간표에서 막차 시간을 찾지 못했습니다.");
        }

        JsonNode last = lastMatch.schedule();
        TagoStation matchedOrigin = lastMatch.origin();
        TagoStation matchedDestination = lastMatch.destination();
        Map<String, Object> lastDeparture = new LinkedHashMap<>();
        lastDeparture.put("departureTime", scheduleTime(last));
        lastDeparture.put("destinationStationName", firstText(last,
                "endsubwaystationnm", "endSubwayStationNm",
                "destinationStationName", "endStationName", "terminalStationName",
                "arrivalStationName", "subwayStationName"));
        lastDeparture.put("routeName", firstText(last, "subwayRouteName", "subwayRouteNm", "routeName", "routeNm"));
        lastDeparture.put("direction", firstText(last, "upDownTypeCode", "upDownTypeName"));
        lastDeparture.put("originRouteName", matchedOrigin.routeName());
        lastDeparture.put("destinationRouteName", matchedDestination.routeName());
        lastDeparture.put("originTagoStationId", matchedOrigin.id());
        lastDeparture.put("destinationTagoStationId", matchedDestination.id());

        result.put("status", "OK");
        result.put("message", "호선별 TAGO 역 ID와 시간표를 대조해 확인한 직통 운행 후보입니다. 환승 경로를 포함한 최종 막차 보장은 아닙니다.");
        result.put("lastDeparture", lastDeparture);
        return result;
    }

    private Map<String, Object> failure(Map<String, Object> result, String status, String message) {
        result.put("status", status);
        result.put("message", message);
        result.put("lastDeparture", null);
        return result;
    }

    private List<KakaoPlaceDto> nearbyStations(double latitude, double longitude) {
        Map<String, Object> response = kakaoPlaceService.searchNearbySubwayStations(latitude, longitude);
        Object documents = response.get("documents");
        if (!(documents instanceof List<?> list) || list.isEmpty()) return List.of();

        List<KakaoPlaceDto> stations = new ArrayList<>();
        List<String> seenNames = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof KakaoPlaceDto station) || station.getPlaceName() == null) continue;
            String normalized = normalizeStationName(station.getPlaceName());
            if (normalized.isBlank() || seenNames.contains(normalized)) continue;
            seenNames.add(normalized);
            stations.add(station);
            // 인근 역 후보를 여러 개 보되, API 호출량이 무제한으로 늘지 않도록 제한한다.
            if (stations.size() >= 8) break;
        }
        return stations;
    }

    private List<TagoStation> resolveTagoStations(List<KakaoPlaceDto> nearby) {
        Map<String, TagoStation> unique = new LinkedHashMap<>();
        for (KakaoPlaceDto place : nearby) {
            String normalizedName = normalizeStationName(place.getPlaceName());
            List<String> queries = new ArrayList<>();
            addCandidate(queries, normalizedName);
            addCandidate(queries, normalizedName + "역");

            for (String query : queries) {
                JsonNode root = requestJson(
                        "https://apis.data.go.kr/1613000/SubwayInfo/GetKwrdFndSubwaySttnList"
                                + "?serviceKey=" + encodedKey()
                                + "&subwayStationName=" + encode(query)
                                + "&pageNo=1&numOfRows=100&_type=json"
                );
                collectTagoStations(root, normalizedName, unique);
            }
        }
        return new ArrayList<>(unique.values());
    }

    private void collectTagoStations(JsonNode node, String target, Map<String, TagoStation> result) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            String name = firstText(node, "subwayStationName", "subwaystationname", "stationName", "stationname");
            String id = firstText(node, "subwayStationId", "subwayStationID", "subwaystationid", "stationId", "stationid");
            String route = firstText(node, "subwayRouteName", "subwayRouteNm", "subwayroutename", "routeName", "routename");
            if (!name.isBlank() && !id.isBlank() && isSameStation(name, target)) {
                TagoStation station = new TagoStation(id, normalizeStationName(name), route);
                result.putIfAbsent(id, station);
            }
            Iterator<JsonNode> values = node.elements();
            while (values.hasNext()) collectTagoStations(values.next(), target, result);
        } else if (node.isArray()) {
            for (JsonNode child : node) collectTagoStations(child, target, result);
        }
    }

    private boolean sameRoute(String first, String second) {
        if (first == null || second == null || first.isBlank() || second.isBlank()) return false;
        String a = normalizeRouteName(first);
        String b = normalizeRouteName(second);
        return !a.isBlank() && a.equals(b);
    }

    private String normalizeRouteName(String route) {
        return route == null ? "" : route
                .replaceAll("\\s+", "")
                .replace("서울", "")
                .replace("수도권", "")
                .replace("지하철", "")
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private Map<String, Object> tagoStationSummary(TagoStation station) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("name", station.name());
        summary.put("routeName", station.routeName());
        summary.put("tagoStationId", station.id());
        return summary;
    }

    private record TagoStation(String id, String name, String routeName) {}
    private record ScheduleMatch(JsonNode schedule, TagoStation origin, TagoStation destination) {}

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
        String value = firstText(node, "depTime", "departureTime", "startTime", "arrtime", "arrivalTime", "arrTime");
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
