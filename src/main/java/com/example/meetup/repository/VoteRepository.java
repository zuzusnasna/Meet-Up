package com.example.meetup.repository;

import com.example.meetup.entity.Vote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VoteRepository extends JpaRepository<Vote, Long> {

    List<Vote> findByPlaceId(Long placeId);

    boolean existsByPlaceIdAndUserId(Long placeId, Long userId);
}
