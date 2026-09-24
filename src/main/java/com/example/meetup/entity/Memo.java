package com.example.meetup.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "MEMOS")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Memo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "MEMO_ID")
    private Long memoId;

    @Column(name = "ROOM_ID", nullable = false)
    private Long roomId;

    @Column(name = "USER_ID", nullable = false)
    private Long userId;

    @Column(name = "CONTENT", nullable = false, length = 500)
    private String content;

    @Column(name = "MEMO_TYPE", length = 30)
    private String memoType;

    @Column(name = "LATITUDE", nullable = false)
    private BigDecimal latitude;

    @Column(name = "LONGITUDE", nullable = false)
    private BigDecimal longitude;

    @Column(name = "CREATED_AT")
    private LocalDateTime createdAt;
}
