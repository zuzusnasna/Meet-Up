package com.example.meetup.service;

import com.example.meetup.dto.VoteFinishResponse;
import com.example.meetup.entity.PlaceCandidate;
import com.example.meetup.entity.Room;
import com.example.meetup.repository.PlaceCandidateRepository;
import com.example.meetup.repository.RoomRepository;
import com.example.meetup.repository.VoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VoteFinishService {

    private final RoomRepository roomRepository;
    private final PlaceCandidateRepository placeCandidateRepository;
    private final VoteRepository voteRepository;

    @Transactional
    public VoteFinishResponse finish(Long roomId, Long userId) {
        Room room = findRoom(roomId);
        validateOwner(room, userId);

        if (room.getVoteFinishedAt() != null) {
            return new VoteFinishResponse(
                    roomId,
                    true,
                    room.getFinalPlaceId(),
                    room.getVoteFinishedAt(),
                    false
            );
        }

        List<PlaceCandidate> candidates = placeCandidateRepository.findByRoomId(roomId);
        if (candidates.isEmpty()) {
            throw new IllegalStateException("먼저 후보 장소를 등록해주세요.");
        }

        Map<Long, Long> voteCounts = candidates.stream()
                .collect(Collectors.toMap(
                        PlaceCandidate::getPlaceId,
                        candidate -> voteRepository.findByPlaceId(candidate.getPlaceId()).stream().count()
                ));

        long maxVotes = voteCounts.values().stream().max(Long::compareTo).orElse(0L);
        if (maxVotes == 0) {
            throw new IllegalStateException("아직 투표가 없습니다.");
        }

        List<PlaceCandidate> winners = candidates.stream()
                .filter(candidate -> voteCounts.get(candidate.getPlaceId()) == maxVotes)
                .sorted(Comparator.comparing(PlaceCandidate::getPlaceId))
                .toList();

        boolean tie = winners.size() > 1;
        PlaceCandidate winner = tie
                ? winners.get(ThreadLocalRandom.current().nextInt(winners.size()))
                : winners.get(0);

        LocalDateTime finishedAt = LocalDateTime.now();
        room.setFinalPlaceId(winner.getPlaceId());
        room.setVoteFinishedAt(finishedAt);
        roomRepository.save(room);

        return new VoteFinishResponse(
                roomId,
                true,
                winner.getPlaceId(),
                finishedAt,
                tie
        );
    }

    @Transactional(readOnly = true)
    public VoteFinishResponse getResult(Long roomId) {
        Room room = findRoom(roomId);
        boolean finished = room.getVoteFinishedAt() != null;
        return new VoteFinishResponse(
                roomId,
                finished,
                room.getFinalPlaceId(),
                room.getVoteFinishedAt(),
                false
        );
    }

    private Room findRoom(Long roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("모임방을 찾을 수 없습니다."));
    }

    private void validateOwner(Room room, Long userId) {
        if (userId == null || !room.getCreatorId().equals(userId)) {
            throw new IllegalStateException("투표 마감은 방장만 할 수 있습니다.");
        }
    }
}
