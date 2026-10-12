package com.example.meetup.service;

import com.example.meetup.entity.PlaceCandidate;
import com.example.meetup.entity.Room;
import com.example.meetup.entity.Vote;
import com.example.meetup.repository.PlaceCandidateRepository;
import com.example.meetup.repository.RoomRepository;
import com.example.meetup.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class VoteService {

    private final VoteRepository voteRepository;
    private final PlaceCandidateRepository placeCandidateRepository;
    private final RoomRepository roomRepository;

    public Vote save(Vote vote) {
        PlaceCandidate candidate = placeCandidateRepository.findById(vote.getPlaceId())
                .orElseThrow(() -> new IllegalArgumentException("후보 장소를 찾을 수 없습니다."));

        Room room = roomRepository.findById(candidate.getRoomId())
                .orElseThrow(() -> new IllegalArgumentException("모임방을 찾을 수 없습니다."));

        if (room.getVoteFinishedAt() != null) {
            throw new IllegalStateException("이미 투표가 마감되었습니다.");
        }

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
