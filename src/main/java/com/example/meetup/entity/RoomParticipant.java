package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.LocalDateTime;

@Entity
@Table(name = "ROOM_PARTICIPANTS")
@IdClass(RoomParticipant.RoomParticipantId.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoomParticipant {

    @Id
    @Column(name = "ROOM_ID")
    private Long roomId;

    @Id
    @Column(name = "USER_ID")
    private Long userId;

    @Column(name = "JOINED_AT")
    private LocalDateTime joinedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoomParticipantId implements Serializable {
        private Long roomId;
        private Long userId;
    }
}
