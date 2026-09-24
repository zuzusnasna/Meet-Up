package com.example.meetup.controller;

import com.example.meetup.entity.Room;
import com.example.meetup.entity.RoomParticipant;
import com.example.meetup.dto.RoomParticipantResponse;
import com.example.meetup.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @PostMapping
    public Room createRoom(
            @RequestParam String roomName,
            @RequestParam Long creatorId
    ) {
        return roomService.createRoom(roomName, creatorId);
    }

    @GetMapping("/{roomId}")
    public Room findById(@PathVariable Long roomId) {
        return roomService.findById(roomId);
    }

    @PostMapping("/{roomId}/participants")
    public RoomParticipant joinRoom(
            @PathVariable Long roomId,
            @RequestParam Long userId
    ) {
        return roomService.joinRoom(roomId, userId);
    }

    @GetMapping("/{roomId}/participants")
    public List<RoomParticipantResponse> findParticipants(@PathVariable Long roomId) {
        return roomService.findParticipants(roomId);
    }
}
