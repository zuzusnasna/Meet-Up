package com.example.meetup.service;

import com.example.meetup.entity.Room;
import com.example.meetup.entity.RoomParticipant;
import com.example.meetup.dto.RoomParticipantResponse;
import com.example.meetup.repository.UserRepository;
import com.example.meetup.repository.RoomParticipantRepository;
import com.example.meetup.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomService {

    private final RoomRepository roomRepository;
    private final RoomParticipantRepository roomParticipantRepository;
    private final UserRepository userRepository;

    public Room createRoom(String roomName, Long creatorId) {
        Room room = Room.builder()
                .roomName(roomName)
                .creatorId(creatorId)
                .createdAt(LocalDateTime.now())
                .build();

        Room savedRoom = roomRepository.save(room);

        RoomParticipant participant = RoomParticipant.builder()
                .roomId(savedRoom.getRoomId())
                .userId(creatorId)
                .joinedAt(LocalDateTime.now())
                .build();

        roomParticipantRepository.save(participant);

        return savedRoom;
    }

    public Room findById(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("모임방을 찾을 수 없습니다."));
    }

    public RoomParticipant joinRoom(Long roomId, Long userId) {
        findById(roomId);

        return roomParticipantRepository.findByRoomIdAndUserId(roomId, userId)
                .orElseGet(() -> roomParticipantRepository.save(
                        RoomParticipant.builder()
                                .roomId(roomId)
                                .userId(userId)
                                .joinedAt(LocalDateTime.now())
                                .build()
                ));
    }

    public List<RoomParticipantResponse> findParticipants(Long roomId) {
        return roomParticipantRepository.findByRoomId(roomId)
                .stream()
                .map(participant -> userRepository.findById(participant.getUserId())
                        .map(user -> new RoomParticipantResponse(
                                participant.getRoomId(),
                                participant.getUserId(),
                                user.getName(),
                                user.getEmail()
                        ))
                        .orElseGet(() -> new RoomParticipantResponse(
                                participant.getRoomId(),
                                participant.getUserId(),
                                null,
                                null
                        )))
                .toList();
    }
}
