package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ROOMS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ROOM_ID")
    private Long roomId;

    @Column(name = "ROOM_NAME", nullable = false, length = 200)
    private String roomName;

    @Column(name = "CREATOR_ID", nullable = false)
    private Long creatorId;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    @Column(name = "FINAL_PLACE_ID")
    private Long finalPlaceId;

    @Column(name = "VOTE_FINISHED_AT")
    private LocalDateTime voteFinishedAt;

}
