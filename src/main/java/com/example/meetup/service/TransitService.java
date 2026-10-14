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

        // 출발역(약속장소)에서 출발하는 시간표를 조회하고,
        // 종착역이 참여자 출발지 주변 역인 직통 운행만 후보로 남긴다.
        for (TagoStation origin : originStations) {
            for (String direction : List.of("U", "D")) {
                JsonNode schedules = fetchSchedules(origin.id(), normalizedDayType, direction);
                for (JsonNode schedule : schedules) {
                    String terminal = firstText(schedule,
                            "endsubwaystationnm", "endSubwayStationNm",
                            "destinationStationName", "endStationName", "terminalStationName",
                            "arrivalStationName", "subwayStationName");
                    String scheduleRoute = firstText(schedule,
                            "subwayRouteName", "subwayRouteNm", "routeName", "routeNm");
                    if (!scheduleRoute.isBlank() && !routesMatch(scheduleRoute, origin.routeName())) continue;

                    for (TagoStation destination : destinationStations) {
                        if (routesMatch(origin.routeName(), destination.routeName())
                                && isSameStation(terminal, destination.name())) {
                            matchingSchedules.add(new ScheduleMatch(schedule, origin, destination));
                        }
                    }
                }
            }
        }

        boolean directRouteFound = !matchingSchedules.isEmpty();

        if (matchingSchedules.isEmpty()) {
            return failure(result, "SCHEDULE_NOT_FOUND",
                    "약속장소 주변 역의 출발 시간표를 찾지 못했습니다. TAGO 응답과 인증키를 확인하세요.");
        }

        ScheduleMatch lastMatch = matchingSchedules.stream()
                .filter(match -> !scheduleTime(match.schedule()).equals("000000"))
                .max(Comparator.comparing(match -> normalizedScheduleTime(scheduleTime(match.schedule()))))
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
        result.put("message", directRouteFound
                ? "호선별 TAGO 시간표에서 확인한 직통 운행 후보입니다. 환승 경로를 포함한 최종 막차 보장은 아닙니다."
                : "직통 운행을 찾지 못해 약속장소 주변 역의 마지막 출발 시각을 참고값으로 표시합니다. 참여자 출발지까지 연결되는 막차 시각은 아닐 수 있습니다.");
        result.put("lastDeparture", lastDeparture);
        return result;
    }


    /**
     * 카카오가 반환한 특정 귀가 경로의 지하철 구간을 기준으로 시간표 연결을 검증한다.
     * 직통 시간표를 찾지 못했다고 인근 역의 가장 늦은 시각을 대신 반환하지 않는다.
     */
    public Map<String, Object> findLastTrainForRoute(
            double originLatitude, double originLongitude,
            double destinationLatitude, double destinationLongitude,
            String dayType, String routeSegmentsJson) {

        String normalizedDayType = normalizeDayType(dayType);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("dayType", normalizedDayType);

        JsonNode segments;
        try {
            segments = objectMapper.readTree(routeSegmentsJson == null ? "[]" : routeSegmentsJson);
        } catch (Exception e) {
            return failure(result, "INVALID_ROUTE", "귀가 경로 정보를 읽지 못했습니다.");
        }
        if (segments == null || !segments.isArray()) {
            return failure(result, "INVALID_ROUTE", "귀가 경로 정보가 올바르지 않습니다.");
        }

        List<RouteLeg> legs = new ArrayList<>();
        for (int i = 0; i < segments.size(); i++) {
            JsonNode segment = segments.get(i);
            if (!"SUBWAY".equalsIgnoreCase(firstText(segment, "type"))) continue;
            JsonNode stops = segment.path("stops");
            if (!stops.isArray() || stops.size() < 2) continue;
            String start = stops.get(0).asText("");
            String end = stops.get(stops.size() - 1).asText("");
            if (start.isBlank() || end.isBlank()) continue;
            int durationMinutes = Math.max(1, (int) Math.ceil(
                    Math.max(0, segment.path("timeSeconds").asDouble(0)) / 60.0));
            legs.add(new RouteLeg(i, start, end, durationMinutes));
        }

        if (legs.isEmpty()) {
            return failure(result, "NO_SUBWAY_SEGMENT",
                    "이 경로에서 시간표를 검증할 지하철 구간을 찾지 못했습니다.");
        }

        List<List<TrainCandidate>> candidatesByLeg = new ArrayList<>();
        for (RouteLeg leg : legs) {
            List<TagoStation> origins = resolveTagoStationsByName(leg.startStation());
            List<TrainCandidate> candidates = new ArrayList<>();
            for (TagoStation station : origins) {
                for (String direction : List.of("U", "D")) {
                    JsonNode schedules = fetchSchedules(station.id(), normalizedDayType, direction);
                    for (JsonNode schedule : schedules) {
                        String time = scheduleTime(schedule);
                        String terminal = firstText(schedule,
                                "endsubwaystationnm", "endSubwayStationNm",
                                "destinationStationName", "endStationName", "terminalStationName",
                                "arrivalStationName");
                        String scheduleRoute = firstText(schedule,
                                "subwayRouteName", "subwayRouteNm", "routeName", "routeNm");
                        if (time.equals("000000") || !isSameStation(terminal, normalizeStationName(leg.endStation()))) continue;
                        if (!scheduleRoute.isBlank() && !station.routeName().isBlank()
                                && !routesMatch(scheduleRoute, station.routeName())) continue;
                        int departureMinutes = scheduleMinutes(time);
                        if (departureMinutes < 0) continue;
                        candidates.add(new TrainCandidate(
                                departureMinutes, schedule, station, leg));
                    }
                }
            }
            candidates.sort(Comparator.comparingInt(TrainCandidate::minutes));
            candidatesByLeg.add(candidates);
        }

        if (candidatesByLeg.stream().anyMatch(List::isEmpty)) {
            return failure(result, "ROUTE_SCHEDULE_NOT_FOUND",
                    "귀가 경로의 지하철 구간 중 종착역과 연결되는 시간표를 찾지 못했습니다.");
        }

        List<TrainCandidate> firstLegCandidates = new ArrayList<>(candidatesByLeg.get(0));
        firstLegCandidates.sort(Comparator.comparingInt(TrainCandidate::minutes).reversed());
        TrainCandidate selectedFirst = null;
        TrainCandidate selectedLast = null;
        for (TrainCandidate first : firstLegCandidates) {
            int currentArrival = first.minutes() + first.leg().durationMinutes();
            boolean connected = true;
            TrainCandidate chainLast = first;
            for (int legIndex = 1; legIndex < legs.size(); legIndex++) {
                RouteLeg previousLeg = legs.get(legIndex - 1);
                RouteLeg currentLeg = legs.get(legIndex);
                int betweenMinutes = 0;
                for (int segmentIndex = previousLeg.segmentIndex() + 1;
                     segmentIndex < currentLeg.segmentIndex(); segmentIndex++) {
                    JsonNode between = segments.get(segmentIndex);
                    betweenMinutes += Math.max(0, (int) Math.ceil(
                            between.path("timeSeconds").asDouble(0) / 60.0));
                }
                int earliestDeparture = currentArrival + betweenMinutes;
                TrainCandidate next = candidatesByLeg.get(legIndex).stream()
                        .map(candidate -> {
                            int departure = candidate.minutes();
                            if (departure < earliestDeparture) departure += 1440;
                            return new TrainCandidate(departure, candidate.schedule(), candidate.station(), candidate.leg());
                        })
                        .filter(candidate -> candidate.minutes() >= earliestDeparture)
                        .min(Comparator.comparingInt(TrainCandidate::minutes))
                        .orElse(null);
                if (next == null) {
                    connected = false;
                    break;
                }
                chainLast = next;
                currentArrival = next.minutes() + currentLeg.durationMinutes();
            }
            if (connected) {
                selectedFirst = first;
                selectedLast = chainLast;
                break;
            }
        }

        if (selectedFirst == null) {
            return failure(result, "NO_CONNECTED_LAST_TRAIN",
                    "각 지하철 구간의 시간표를 연결할 수 있는 막차 조합을 찾지 못했습니다.");
        }

        JsonNode schedule = selectedLast.schedule();
        Map<String, Object> departure = new LinkedHashMap<>();
        departure.put("departureTime", scheduleTime(schedule));
        departure.put("destinationStationName", firstText(schedule,
                "endsubwaystationnm", "endSubwayStationNm",
                "destinationStationName", "endStationName", "terminalStationName", "arrivalStationName"));
        departure.put("routeName", firstText(schedule, "subwayRouteName", "subwayRouteNm", "routeName", "routeNm"));
        departure.put("direction", firstText(schedule, "upDownTypeCode", "upDownTypeName"));
        departure.put("routeSegmentIndex", selectedLast.leg().segmentIndex());
        departure.put("originStationName", selectedLast.leg().startStation());
        departure.put("originTagoStationId", selectedLast.station().id());
        departure.put("destinationStationNameOnRoute", selectedLast.leg().endStation());

        result.put("status", "OK");
        result.put("message", "귀가 경로의 지하철 구간별 시간표와 환승 연결을 확인한 출발 시각입니다. 실제 운행 지연과 역 내 이동시간에 따라 달라질 수 있습니다.");
        result.put("lastDeparture", departure);
        return result;
    }

    private List<TagoStation> resolveTagoStationsByName(String stationName) {
        String target = normalizeStationName(stationName);
        Map<String, TagoStation> unique = new LinkedHashMap<>();
        for (String query : List.of(target, target + "역")) {
            JsonNode root = requestJson(
                    "https://apis.data.go.kr/1613000/SubwayInfo/GetKwrdFndSubwaySttnList"
                            + "?serviceKey=" + encodedKey()
                            + "&subwayStationName=" + encode(query)
                            + "&pageNo=1&numOfRows=100&_type=json");
            collectTagoStations(root, target, unique);
        }
        return new ArrayList<>(unique.values());
    }

    private record RouteLeg(int segmentIndex, String startStation, String endStation, int durationMinutes) {}
    private record TrainCandidate(int minutes, JsonNode schedule, TagoStation station, RouteLeg leg) {}

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

    private boolean isSameStation(String name, String target) {
        String normalized = normalizeStationName(name);
        return !normalized.isBlank() && target != null && !target.isBlank()
                && (normalized.equals(target)
                || normalized.startsWith(target + "(")
                || normalized.startsWith(target + "[")
                || target.startsWith(normalized + "(")
                || target.startsWith(normalized + "[")
                || normalized.contains(target)
                || target.contains(normalized));
    }

    private void addCandidate(List<String> candidates, String value) {
        if (value != null && !value.isBlank() && !candidates.contains(value)) {
            candidates.add(value);
        }
    }

    private boolean routesMatch(String first, String second) {
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
        String value = firstText(node, "depTime", "dep_time", "departureTime", "departure_time",
                "startTime", "subwayDepartureTime", "subwayDepTime",
                "arrtime", "arrivalTime", "arrival_time", "arrTime");
        String digits = value.replaceAll("[^0-9]", "");
        if (digits.isBlank()) return "000000";
        if (digits.length() == 4) return digits + "00";
        if (digits.length() == 5) return "0" + digits;
        return digits.length() > 6 ? digits.substring(0, 6) : digits;
    }

    private int scheduleMinutes(String value) {
        String normalized = normalizedScheduleTime(value);
        try {
            int hours = Integer.parseInt(normalized.substring(0, 2));
            int minutes = Integer.parseInt(normalized.substring(2, 4));
            return hours * 60 + minutes;
        } catch (RuntimeException e) {
            return -1;
        }
    }

    private String normalizedScheduleTime(String value) {
        String digits = value == null ? "" : value.replaceAll("[^0-9]", "");
        if (digits.length() == 4) return digits + "00";
        if (digits.length() == 5) return "0" + digits;
        return digits.length() > 6 ? digits.substring(0, 6) : digits;
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
