package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "VOTES")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Vote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "VOTE_ID")
    private Long voteId;

    @Column(name = "PLACE_ID", nullable = false)
    private Long placeId;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
}