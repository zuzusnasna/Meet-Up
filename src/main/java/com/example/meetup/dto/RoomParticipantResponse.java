package com.example.meetup.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class RoomParticipantResponse {
    private Long roomId;
    private Long userId;
    private String userName;
    private String email;
}
