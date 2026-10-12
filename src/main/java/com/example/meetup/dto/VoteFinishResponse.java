package com.example.meetup.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class VoteFinishResponse {
    private Long roomId;
    private boolean finished;
    private Long finalPlaceId;
    private LocalDateTime finishedAt;
    private boolean tie;
    private long finalVoteCount;
}
