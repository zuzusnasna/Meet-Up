package com.example.meetup.repository;

import com.example.meetup.entity.Location;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LocationRepository extends JpaRepository<Location, Long> {

    List<Location> findByRoomId(Long roomId);

    List<Location> findByUserId(Long userId);
}
