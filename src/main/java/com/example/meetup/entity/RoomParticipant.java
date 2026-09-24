package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ROOM_PARTICIPANTS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ROOM_ID")
    private Long roomId;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    @Column(name = "JOINED_AT")
    private LocalDateTime joinedAt;
}
