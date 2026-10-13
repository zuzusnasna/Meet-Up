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
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class BusTransitService {

    @Value("${tour.api-key}")
    private String serviceKey;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> findBusArrivals(double latitude, double longitude) {
        Map<String, Object> result = new LinkedHashMap<>();
        JsonNode station = findNearbyStation(latitude, longitude);

        if (station == null) {
            result.put("status", "BUS_STATION_NOT_FOUND");
            result.put("message", "약속장소 주변 500m에서 TAGO 버스정류장을 찾지 못했습니다.");
            return result;
        }

        String cityCode = firstText(station, "citycode", "cityCode");
        String nodeId = firstText(station, "nodeid", "nodeId");
        String nodeName = firstText(station, "nodenm", "nodeNm", "nodeName");

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
        JsonNode root = requestJson(
                "https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList"
                        + "?serviceKey=" + encodedKey()
                        + "&gpsLati=" + latitude
                        + "&gpsLong=" + longitude
                        + "&pageNo=1&numOfRows=10&_type=json"
        );
        return findStationNode(root);
    }

    private JsonNode findStationNode(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isObject()) {
            String nodeId = firstText(node, "nodeid", "nodeId");
            String cityCode = firstText(node, "citycode", "cityCode");
            if (!nodeId.isBlank() && !cityCode.isBlank()) return node;
            Iterator<JsonNode> values = node.elements();
            while (values.hasNext()) {
                JsonNode found = findStationNode(values.next());
                if (found != null) return found;
            }
        } else if (node.isArray()) {
            for (JsonNode child : node) {
                JsonNode found = findStationNode(child);
                if (found != null) return found;
            }
        }
        return null;
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
