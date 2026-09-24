package com.example.meetup.repository;

import com.example.meetup.entity.PlaceCandidate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaceCandidateRepository extends JpaRepository<PlaceCandidate, Long> {

    List<PlaceCandidate> findByRoomId(Long roomId);
}
