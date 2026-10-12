package com.example.meetup.dto;

import com.example.meetup.entity.Room;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class RoomResponse {
    private Long roomId;
    private String roomName;
    private Long creatorId;
    private LocalDateTime createdAt;
    private Long finalPlaceId;
    private LocalDateTime voteFinishedAt;
    private String creatorName;
    private String creatorProvider;

    public static RoomResponse of(Room room, String creatorName, String creatorProvider) {
        return new RoomResponse(
                room.getRoomId(),
                room.getRoomName(),
                room.getCreatorId(),
                room.getCreatedAt(),
                room.getFinalPlaceId(),
                room.getVoteFinishedAt(),
                creatorName,
                creatorProvider
        );
    }
}
