package com.example.meetup.service;

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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class KakaoTransitRouteService {

    @Value("${kakao.rest-api-key}")
    private String restApiKey;

    private final TransitService transitService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Returns homeward public-transit routes: meeting place -> participant origin.
     * Kakao supplies route/transfer structure; TAGO is used only for subway timetable checks.
     */
    public Map<String, Object> findReturnRoutes(
            double meetingLatitude, double meetingLongitude,
            double originLatitude, double originLongitude) {

        JsonNode root = requestRoutes(meetingLongitude, meetingLatitude, originLongitude, originLatitude);
        Map<String, Object> result = new LinkedHashMap<>();
        String status = text(root, "status");
        result.put("status", status);
        result.put("origin", point("사용자 출발지", originLatitude, originLongitude));
        result.put("meetingPlace", point("약속장소", meetingLatitude, meetingLongitude));

        if (!"OK".equalsIgnoreCase(status)) {
            result.put("message", "카카오 대중교통 경로를 찾지 못했습니다: " + (status.isBlank() ? "응답 상태 없음" : status));
            result.put("routes", List.of());
            return result;
        }

        JsonNode routeNodes = root.path("routes");
        List<Map<String, Object>> routes = new ArrayList<>();
        if (routeNodes.isArray()) {
            for (JsonNode routeNode : routeNodes) {
                Map<String, Object> route = new LinkedHashMap<>();
                JsonNode props = routeNode.path("properties");
                route.put("type", text(props, "type"));
                route.put("totalDistanceMeters", number(props, "totalDistance"));
                route.put("totalTimeSeconds", number(props, "totalTime"));
                route.put("transferCount", number(props, "transfers"));

                List<Map<String, Object>> segments = new ArrayList<>();
                JsonNode steps = routeNode.path("steps");
                if (steps.isArray()) {
                    for (JsonNode step : steps) {
                        segments.add(parseSegment(step));
                    }
                }
                route.put("segments", segments);
                routes.add(route);
            }
        }
        result.put("routes", routes);
        result.put("message", "카카오 대중교통 경로와 환승 구간을 조회했습니다. 지하철은 TAGO 시간표 조회를 시도하고, 버스 막차는 별도 운행시간표 데이터가 없어 확정 표시하지 않습니다.");
        return result;
    }

    private Map<String, Object> parseSegment(JsonNode step) {
        JsonNode props = step.path("properties");
        String type = text(props, "type");
        Map<String, Object> segment = new LinkedHashMap<>();
        segment.put("type", type);
        segment.put("guidance", text(props, "guidance"));
        segment.put("distanceMeters", number(props, "distance"));
        segment.put("timeSeconds", number(props, "time"));

        List<String> stops = new ArrayList<>();
        JsonNode stopNodes = props.path("stops");
        if (stopNodes.isArray()) {
            for (JsonNode stop : stopNodes) {
                String name = text(stop, "name");
                if (!name.isBlank() && (stops.isEmpty() || !stops.get(stops.size() - 1).equals(name))) {
                    stops.add(name);
                }
            }
        }
        segment.put("stops", stops);

        List<String> vehicles = new ArrayList<>();
        JsonNode vehicleNodes = props.path("vehicles");
        if (vehicleNodes.isArray()) {
            for (JsonNode vehicle : vehicleNodes) {
                String name = text(vehicle, "name");
                String vehicleType = text(vehicle, "type");
                String display = vehicleType.isBlank() ? name : vehicleType + " " + name;
                if (!display.isBlank() && !vehicles.contains(display)) vehicles.add(display);
            }
        }
        segment.put("vehicles", vehicles);

        JsonNode points = step.path("path").path("points");
        if ("SUBWAY".equalsIgnoreCase(type)) {
            Map<String, Object> lastTrain = findSegmentLastTrain(points);
            segment.put("lastTrain", lastTrain);
        } else if ("BUS".equalsIgnoreCase(type)) {
            Map<String, Object> lastBus = new LinkedHashMap<>();
            lastBus.put("status", "TIMETABLE_UNAVAILABLE");
            lastBus.put("message", "현재 연결된 버스 API는 실시간 도착정보만 제공해 이 구간의 막차 시각을 확정할 수 없습니다.");
            segment.put("lastBus", lastBus);
        }
        return segment;
    }

    private Map<String, Object> findSegmentLastTrain(JsonNode points) {
        Map<String, Object> unavailable = new LinkedHashMap<>();
        unavailable.put("status", "UNAVAILABLE");
        unavailable.put("message", "이 지하철 구간의 시간표를 확인하지 못했습니다.");

        if (!points.isArray() || points.size() < 2
                || !points.get(0).isArray() || points.get(0).size() < 2
                || !points.get(points.size() - 1).isArray()
                || points.get(points.size() - 1).size() < 2) {
            return unavailable;
        }

        JsonNode start = points.get(0);
        JsonNode end = points.get(points.size() - 1);
        double startLongitude = start.get(0).asDouble(Double.NaN);
        double startLatitude = start.get(1).asDouble(Double.NaN);
        double endLongitude = end.get(0).asDouble(Double.NaN);
        double endLatitude = end.get(1).asDouble(Double.NaN);
        if (!Double.isFinite(startLatitude) || !Double.isFinite(startLongitude)
                || !Double.isFinite(endLatitude) || !Double.isFinite(endLongitude)) {
            return unavailable;
        }

        try {
            // Route is meeting -> home. TransitService compares a departure station
            // against the train terminal, so its origin/destination arguments are reversed here.
            Map<String, Object> schedule = transitService.findLastTrain(
                    endLatitude, endLongitude, startLatitude, startLongitude, null);
            Object lastDeparture = schedule.get("lastDeparture");
            if ("OK".equals(schedule.get("status")) && lastDeparture != null) {
                Map<String, Object> response = new LinkedHashMap<>();
                response.put("status", "OK");
                response.put("lastDeparture", lastDeparture);
                response.put("message", "TAGO 역 시간표에서 확인한 직통 운행 후보입니다. 실제 환승 가능 여부는 보장하지 않습니다.");
                return response;
            }
            unavailable.put("message", schedule.getOrDefault("message", unavailable.get("message")));
            unavailable.put("lookupStatus", schedule.get("status"));
            return unavailable;
        } catch (RuntimeException exception) {
            unavailable.put("message", "지하철 시간표 조회에 실패했습니다. 잠시 후 다시 시도하세요.");
            return unavailable;
        }
    }

    private JsonNode requestRoutes(double startLongitude, double startLatitude,
                                   double endLongitude, double endLatitude) {
        HttpURLConnection connection = null;
        try {
            String url = "https://dapi.kakao.com/v2/routing/publictraffic"
                    + "?start_x=" + encode(Double.toString(startLongitude))
                    + "&start_y=" + encode(Double.toString(startLatitude))
                    + "&end_x=" + encode(Double.toString(endLongitude))
                    + "&end_y=" + encode(Double.toString(endLatitude))
                    + "&s_name=" + encode("약속장소")
                    + "&e_name=" + encode("사용자 출발지");
            connection = (HttpURLConnection) URI.create(url).toURL().openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(10000);
            connection.setRequestProperty("Authorization", "KakaoAK " + (restApiKey == null ? "" : restApiKey.trim()));
            connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                    status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(),
                    StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("Kakao public transit API HTTP " + status + ": " + body);
                }
                return objectMapper.readTree(body.toString());
            }
        } catch (Exception e) {
            throw new IllegalStateException("카카오 대중교통 경로 API 호출에 실패했습니다. REST API 키와 카카오맵 API 사용 설정을 확인하세요.", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private Map<String, Object> point(String name, double latitude, double longitude) {
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("name", name);
        point.put("latitude", latitude);
        point.put("longitude", longitude);
        return point;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "" : value.asText("");
    }

    private int number(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? 0 : value.asInt(0);
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
