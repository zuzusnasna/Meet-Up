package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "PLACE_CANDIDATES")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaceCandidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "PLACE_ID")
    private Long placeId;

    @Column(name = "ROOM_ID", nullable = false)
    private Long roomId;

    @Column(name = "PLACE_NAME", nullable = false, length = 200)
    private String placeName;

    @Column(name = "ADDRESS", length = 500)
    private String address;

    @Column(name = "LATITUDE", nullable = false)
    private BigDecimal latitude;

    @Column(name = "LONGITUDE", nullable = false)
    private BigDecimal longitude;

    @Column(name = "KAKAO_PLACE_ID", length = 100)
    private String kakaoPlaceId;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
}
