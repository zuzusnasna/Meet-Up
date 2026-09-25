package com.example.meetup.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class PlaceCandidateResponse {

    private Long placeId;
    private Long roomId;
    private Long userId;
    private String userName;
    private String placeName;
    private String address;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String kakaoPlaceId;
    private LocalDateTime createdAt;
}
