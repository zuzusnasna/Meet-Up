package com.example.meetup.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;

@Service
public class KakaoPlaceService {

    @Value("${kakao.rest-api-key}")
    private String restApiKey;

    public String searchPlace(String query) {

        try {
            String encodedQuery =
                    URLEncoder.encode(query, StandardCharsets.UTF_8);

            String urlString =
                    "https://dapi.kakao.com/v2/local/search/keyword.json?query="
                            + encodedQuery;

            System.out.println("================================");
            System.out.println("Kakao 요청 URL = " + urlString);
            System.out.println("API KEY 길이 = " + restApiKey.length());
            System.out.println("================================");

            URL url = new URL(urlString);

            HttpURLConnection connection =
                    (HttpURLConnection) url.openConnection();

            connection.setRequestMethod("GET");

            connection.setRequestProperty(
                    "Authorization",
                    "KakaoAK " + restApiKey
            );

            int statusCode = connection.getResponseCode();

            System.out.println("Kakao 상태 코드 = " + statusCode);

            BufferedReader reader;

            if (statusCode >= 200 && statusCode < 300) {
                reader = new BufferedReader(
                        new InputStreamReader(
                                connection.getInputStream(),
                                StandardCharsets.UTF_8
                        )
                );
            } else {
                reader = new BufferedReader(
                        new InputStreamReader(
                                connection.getErrorStream(),
                                StandardCharsets.UTF_8
                        )
                );
            }

            StringBuilder response = new StringBuilder();

            String line;

            while ((line = reader.readLine()) != null) {
                response.append(line);
            }

            reader.close();

            System.out.println("Kakao 응답 = " + response);

            return response.toString();

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Kakao API 호출 실패", e);
        }
    }
}