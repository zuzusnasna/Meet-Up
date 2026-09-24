package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "LOCATIONS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "LOCATION_ID")
    private Long locationId;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    @Column(name = "ROOM_ID", nullable = false)
    private Long roomId;

    @Column(name = "ADDRESS", nullable = false, length = 500)
    private String address;

    @Column(name = "LATITUDE", nullable = false)
    private BigDecimal latitude;

    @Column(name = "LONGITUDE", nullable = false)
    private BigDecimal longitude;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
}
