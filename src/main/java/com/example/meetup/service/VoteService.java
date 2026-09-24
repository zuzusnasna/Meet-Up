package com.example.meetup.service;

import com.example.meetup.entity.Vote;
import com.example.meetup.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteRepository voteRepository;

    public Vote save(Vote vote) {

        if (voteRepository.existsByPlaceIdAndUserId(
                vote.getPlaceId(),
                vote.getUserId())) {

            throw new IllegalStateException("이미 투표한 장소입니다.");
        }

        vote.setCreatedAt(LocalDateTime.now());

        return voteRepository.save(vote);
    }

    public List<Vote> findByPlaceId(Long placeId) {
        return voteRepository.findByPlaceId(placeId);
    }
}