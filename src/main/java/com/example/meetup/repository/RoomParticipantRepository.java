package com.example.meetup.repository;

import com.example.meetup.entity.RoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, Long> {
    List<RoomParticipant> findByRoomId(Long roomId);
    Optional<RoomParticipant> findByRoomIdAndUserId(Long roomId, Long userId);
}
