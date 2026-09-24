package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "USERS",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "UK_USERS_SOCIAL",
                        columnNames = {"SOCIAL_ID", "PROVIDER"}
                )
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "USER_ID")
    private Long userId;

    @Column(name = "SOCIAL_ID", nullable = false, length = 100)
    private String socialId;

    @Column(name = "PROVIDER", nullable = false, length = 30)
    private String provider;

    @Column(name = "NAME", length = 100)
    private String name;

    @Column(name = "EMAIL", length = 200)
    private String email;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;

    @Column(name = "UPDATED_AT")
    private LocalDateTime updatedAt;
}