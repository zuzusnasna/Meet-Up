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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class KakaoTransitRouteService {

    private static final System.Logger LOGGER = System.getLogger(KakaoTransitRouteService.class.getName());
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    @Value("${kakao.rest-api-key}")
    private String restApiKey;

    private final ObjectMapper objectMapper;
    private final RedisCacheService redisCacheService;
    private final LastTrainService lastTrainService;

    public Map<String, Object> findReturnRoutes(
            double meetingLatitude, double meetingLongitude,
            double originLatitude, double originLongitude) {
        return findReturnRoutes(meetingLatitude, meetingLongitude, originLatitude, originLongitude, false);
    }

    public Map<String, Object> findReturnRoutes(
            double meetingLatitude, double meetingLongitude,
            double originLatitude, double originLongitude,
            boolean refresh) {

        String cacheKey = redisCacheService.versionedKey(
                "transit:route:v4",
                coordinate(meetingLatitude), coordinate(meetingLongitude),
                coordinate(originLatitude), coordinate(originLongitude));

        if (!refresh) {
            Map<String, Object> cached = redisCacheService.get(cacheKey, MAP_TYPE);
            if (hasUsableRoutes(cached)) return cached;
            if (cached != null) redisCacheService.delete(cacheKey);
        } else {
            redisCacheService.delete(cacheKey);
        }

        JsonNode root = requestRoutes(meetingLongitude, meetingLatitude, originLongitude, originLatitude);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("origin", point("사용자 출발지", originLatitude, originLongitude));
        result.put("meetingPlace", point("약속장소", meetingLatitude, meetingLongitude));

        JsonNode routes = root.path("routes");
        List<Map<String, Object>> routeList = new ArrayList<>();
        if (!routes.isArray()) {
            result.put("routes", routeList);
            result.put("message", "카카오에서 대중교통 경로를 찾지 못했습니다.");
            redisCacheService.delete(cacheKey);
            return result;
        }

        for (JsonNode routeNode : routes) {
            Map<String, Object> route = new LinkedHashMap<>();
            JsonNode properties = routeNode.path("properties");
            route.put("type", text(properties, "type"));
            route.put("totalDistanceMeters", number(properties, "totalDistance"));
            route.put("totalTimeSeconds", number(properties, "totalTime"));
            route.put("transferCount", number(properties, "transfers"));

            List<Map<String, Object>> segments = new ArrayList<>();
            JsonNode steps = routeNode.path("steps");
            if (steps.isArray()) {
                for (JsonNode step : steps) {
                    segments.add(parseSegment(step));
                }
            }
            route.put("segments", segments);

            try {
                route.put("lastTrain", lastTrainService.findLastTrainForRoute(segments));
            } catch (Exception e) {
                Map<String, Object> lastTrainError = new LinkedHashMap<>();
                lastTrainError.put("status", "ERROR");
                lastTrainError.put("message", "이 경로의 막차 정보를 조회하지 못했습니다.");
                lastTrainError.put("lastDeparture", null);
                route.put("lastTrain", lastTrainError);
                LOGGER.log(System.Logger.Level.WARNING, "last-train lookup failed", e);
            }
            routeList.add(route);
        }

        result.put("routes", routeList);
        result.put("message", "약속장소에서 출발지까지의 대중교통 경로를 조회했습니다.");

        if (!routeList.isEmpty() && shouldCacheResult(routeList)) {
            redisCacheService.put(cacheKey, result, null);
        } else if (routeList.isEmpty()) {
            redisCacheService.delete(cacheKey);
        }
        return result;
    }

    private boolean hasUsableRoutes(Map<String, Object> cached) {
        if (cached == null) return false;
        Object routesValue = cached.get("routes");
        if (!(routesValue instanceof List<?> routes) || routes.isEmpty()) return false;

        for (Object routeValue : routes) {
            if (!(routeValue instanceof Map<?, ?> route)) continue;
            Object segmentsValue = route.get("segments");
            if (!(segmentsValue instanceof List<?> segments)) continue;

            boolean hasSubway = segments.stream().anyMatch(segment -> segment instanceof Map<?, ?> map
                    && "SUBWAY".equalsIgnoreCase(String.valueOf(map.get("type"))));
            if (!hasSubway) continue;

            Object lastTrainValue = route.get("lastTrain");
            if (!(lastTrainValue instanceof Map<?, ?> lastTrain)
                    || !"OK".equals(String.valueOf(lastTrain.get("status")))) {
                return false;
            }
        }
        return true;
    }

    private boolean shouldCacheResult(List<Map<String, Object>> routes) {
        for (Map<String, Object> route : routes) {
            Object segmentsValue = route.get("segments");
            if (!(segmentsValue instanceof List<?> segments)) continue;
            boolean hasSubway = segments.stream().anyMatch(segment -> segment instanceof Map<?, ?> map
                    && "SUBWAY".equalsIgnoreCase(String.valueOf(map.get("type"))));
            if (!hasSubway) continue;

            Object lastTrainValue = route.get("lastTrain");
            if (!(lastTrainValue instanceof Map<?, ?> lastTrain)) return false;
            if (!"OK".equals(String.valueOf(lastTrain.get("status")))) return false;
        }
        return true;
    }

    private Map<String, Object> parseSegment(JsonNode step) {
        JsonNode properties = step.path("properties");
        Map<String, Object> segment = new LinkedHashMap<>();
        String rawType = text(properties, "type");
        String normalizedType = rawType == null ? "" : rawType.trim().toUpperCase();
        if (normalizedType.equals("WALK") || normalizedType.equals("FOOT") || normalizedType.equals("WALKING")) {
            normalizedType = "WALKING";
        }
        segment.put("type", normalizedType);
        segment.put("guidance", text(properties, "guidance"));
        segment.put("distanceMeters", number(properties, "distance"));
        segment.put("timeSeconds", number(properties, "time"));

        List<String> stops = new ArrayList<>();
        JsonNode stopNodes = properties.path("stops");
        if (stopNodes.isArray()) {
            for (JsonNode stop : stopNodes) {
                String name = text(stop, "name");
                if (!name.isBlank() && (stops.isEmpty() || !stops.get(stops.size() - 1).equals(name))) stops.add(name);
            }
        }
        segment.put("stops", stops);

        List<Map<String, Object>> vehicles = new ArrayList<>();
        JsonNode vehicleNodes = properties.path("vehicles");
        if (vehicleNodes.isArray()) {
            for (JsonNode vehicle : vehicleNodes) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("name", text(vehicle, "name"));
                item.put("type", text(vehicle, "type"));
                vehicles.add(item);
            }
        }
        segment.put("vehicles", vehicles);

        List<List<Double>> path = new ArrayList<>();
        JsonNode points = step.path("path").path("points");
        if (points.isArray()) {
            for (JsonNode point : points) {
                if (point.isArray() && point.size() >= 2) {
                    List<Double> coordinate = new ArrayList<>();
                    coordinate.add(point.get(0).asDouble());
                    coordinate.add(point.get(1).asDouble());
                    path.add(coordinate);
                }
            }
        }
        segment.put("path", path);
        return segment;
    }

    private JsonNode requestRoutes(double startLongitude, double startLatitude, double endLongitude, double endLatitude) {
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
                    status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(), StandardCharsets.UTF_8))) {
                StringBuilder body = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
                if (status < 200 || status >= 300) throw new IllegalStateException("Kakao public transit API HTTP " + status + ": " + body);
                return objectMapper.readTree(body.toString());
            }
        } catch (Exception e) {
            throw new IllegalStateException("카카오 대중교통 경로 API 호출에 실패했습니다.", e);
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

    private String coordinate(double value) {
        return String.format(java.util.Locale.ROOT, "%.5f", value);
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
