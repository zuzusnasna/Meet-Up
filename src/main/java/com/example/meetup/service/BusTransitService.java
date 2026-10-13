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
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BusTransitService {

    private static final double INITIAL_RADIUS_METERS = 500.0;
    private static final double EXPANDED_RADIUS_METERS = 1000.0;

    @Value("${tago.service-key}")
    private String serviceKey;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> findBusArrivals(double latitude, double longitude) {
        Map<String, Object> result = new LinkedHashMap<>();
        JsonNode station = findNearbyStation(latitude, longitude);

        if (station == null) {
            result.put("status", "BUS_STATION_NOT_FOUND");
            result.put("message", "TAGO 응답에서 약속장소 주변 버스정류장을 찾지 못했습니다.");
            return result;
        }

        String cityCode = firstText(station, "citycode", "cityCode", "city_code");
        String nodeId = firstText(station, "nodeid", "nodeId", "node_id");
        String nodeName = firstText(station, "nodenm", "nodeNm", "nodeName", "node_name");

        if (cityCode.isBlank() || nodeId.isBlank()) {
            result.put("status", "BUS_STATION_DATA_INVALID");
            result.put("message", "TAGO 버스정류장 응답에서 도시코드 또는 정류장 ID를 확인하지 못했습니다.");
            return result;
        }

        JsonNode arrivals = requestJson(
                "https://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList"
                        + "?serviceKey=" + encodedKey()
                        + "&cityCode=" + encode(cityCode)
                        + "&nodeId=" + encode(nodeId)
                        + "&pageNo=1&numOfRows=10&_type=json"
        );

        JsonNode items = arrivals.path("response").path("body").path("items").path("item");
        result.put("status", "OK");
        result.put("message", "TAGO 버스정류장 실시간 도착정보가 연동되었습니다. 이 API는 운행시간표의 막차 시각이 아니라 현재 도착예정정보를 제공합니다.");
        result.put("stationName", nodeName);
        result.put("cityCode", cityCode);
        result.put("nodeId", nodeId);
        result.put("arrivals", items.isArray() ? items : items.isObject() ? objectMapper.createArrayNode().add(items) : objectMapper.createArrayNode());
        return result;
    }

    private JsonNode findNearbyStation(double latitude, double longitude) {
        // TAGO의 좌표 기반 정류장 API는 검색 반경 대신 조회 건수를 받으므로
        // 후보를 넉넉히 조회한 뒤 응답 좌표로 500m, 1km 범위를 판별한다.
        JsonNode root = requestNearbyStations(latitude, longitude, 100);
        List<JsonNode> stations = new ArrayList<>();
        collectStations(root, stations);

        JsonNode nearestWithinInitialRadius = nearestStationWithin(
                stations, latitude, longitude, INITIAL_RADIUS_METERS, true);
        if (nearestWithinInitialRadius != null) {
            return nearestWithinInitialRadius;
        }

        JsonNode nearestWithinExpandedRadius = nearestStationWithin(
                stations, latitude, longitude, EXPANDED_RADIUS_METERS, true);
        if (nearestWithinExpandedRadius != null) {
            return nearestWithinExpandedRadius;
        }

        // 응답에 정류장 ID는 있지만 좌표 필드가 제공되지 않는 경우,
        // TAGO의 좌표 기반 검색 결과 순서를 이용해 첫 후보를 사용한다.
        boolean hasAnyCoordinates = stations.stream().anyMatch(this::hasCoordinates);
        if (!hasAnyCoordinates && !stations.isEmpty()) {
            return stations.get(0);
        }
        return null;
    }

    private JsonNode requestNearbyStations(double latitude, double longitude, int numOfRows) {
        return requestJson(
                "https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList"
                        + "?serviceKey=" + encodedKey()
                        + "&gpsLati=" + latitude
                        + "&gpsLong=" + longitude
                        + "&pageNo=1&numOfRows=" + numOfRows + "&_type=json"
        );
    }

    private JsonNode nearestStationWithin(
            List<JsonNode> stations, double latitude, double longitude,
            double radiusMeters, boolean requireCoordinates) {
        JsonNode nearest = null;
        double nearestDistance = Double.MAX_VALUE;

        for (JsonNode station : stations) {
            double stationLatitude = parseCoordinate(firstText(station,
                    "gpslati", "gpsLati", "gpsLatitude", "gpslatitude", "latitude", "gps_latitude"));
            double stationLongitude = parseCoordinate(firstText(station,
                    "gpslong", "gpsLong", "gpsLongitude", "gpslongitude", "longitude", "gps_longitude"));

            if (Double.isNaN(stationLatitude) || Double.isNaN(stationLongitude)) {
                if (!requireCoordinates && nearest == null) {
                    nearest = station;
                }
                continue;
            }

            double distance = distanceMeters(latitude, longitude, stationLatitude, stationLongitude);
            if (distance <= radiusMeters && distance < nearestDistance) {
                nearest = station;
                nearestDistance = distance;
            }
        }
        return nearest;
    }

    private boolean hasCoordinates(JsonNode station) {
        return !Double.isNaN(parseCoordinate(firstText(station,
                "gpslati", "gpsLati", "gpsLatitude", "gpslatitude", "latitude", "gps_latitude")))
                && !Double.isNaN(parseCoordinate(firstText(station,
                "gpslong", "gpsLong", "gpsLongitude", "gpslongitude", "longitude", "gps_longitude")));
    }

    private void collectStations(JsonNode node, List<JsonNode> stations) {
        if (node == null || node.isNull()) return;
        if (node.isObject()) {
            String nodeId = firstText(node, "nodeid", "nodeId", "node_id");
            String cityCode = firstText(node, "citycode", "cityCode", "city_code");
            if (!nodeId.isBlank() && !cityCode.isBlank()) {
                stations.add(node);
                return;
            }
            Iterator<JsonNode> values = node.elements();
            while (values.hasNext()) {
                collectStations(values.next(), stations);
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                collectStations(child, stations);
            }
        }
    }

    private double parseCoordinate(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    private double distanceMeters(double latitude1, double longitude1, double latitude2, double longitude2) {
        double earthRadiusMeters = 6_371_000.0;
        double latDistance = Math.toRadians(latitude2 - latitude1);
        double lonDistance = Math.toRadians(longitude2 - longitude1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(latitude1)) * Math.cos(Math.toRadians(latitude2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
                if (status < 200 || status >= 300) throw new IllegalStateException("TAGO bus API HTTP " + status + " - " + body);
                return objectMapper.readTree(body.toString());
            }
        } catch (Exception e) {
            throw new IllegalStateException("TAGO 버스 API 요청에 실패했습니다. 활용신청과 인증키를 확인하세요.", e);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = node.get(field);
            if (value != null && !value.isNull() && !value.asText().isBlank()) return value.asText();
        }
        return "";
    }

    private String encodedKey() {
        String key = serviceKey == null ? "" : serviceKey.trim();
        return key.matches(".*%[0-9A-Fa-f]{2}.*") ? key : encode(key);
    }

    private String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
