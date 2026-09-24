package com.example.meetup.repository;

import com.example.meetup.entity.Location;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LocationRepository extends JpaRepository<Location, Long> {

    List<Location> findByRoomId(Long roomId);

    List<Location> findByUserId(Long userId);

    Optional<Location> findByRoomIdAndUserId(Long roomId, Long userId);
}
