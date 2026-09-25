package com.example.meetup.service;

import com.example.meetup.entity.PlaceCandidate;
import com.example.meetup.dto.PlaceCandidateResponse;
import com.example.meetup.repository.PlaceCandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlaceCandidateService {

    private final PlaceCandidateRepository placeCandidateRepository;

    public PlaceCandidate save(PlaceCandidate placeCandidate) {

        if (placeCandidate.getUserId() == null) {
            throw new IllegalArgumentException("후보 장소 등록자 정보가 필요합니다.");
        }

        boolean alreadyExists = placeCandidateRepository.existsByRoomIdAndKakaoPlaceId(
                placeCandidate.getRoomId(),
                placeCandidate.getKakaoPlaceId()
        );

        if (alreadyExists) {
            throw new IllegalStateException(
                    "이미 다른 참여자가 추천한 장소입니다."
            );
        }

        long count = placeCandidateRepository.countByRoomIdAndUserId(
                placeCandidate.getRoomId(),
                placeCandidate.getUserId()
        );

        if (count >= 3) {
            throw new IllegalStateException(
                    "한 참여자는 후보 장소를 최대 3개까지 등록할 수 있습니다."
            );
        }

        return placeCandidateRepository.save(placeCandidate);
    }

    public List<PlaceCandidateResponse> findByRoomId(Long roomId) {
        return placeCandidateRepository.findResponsesByRoomId(roomId);
    }

    public void delete(Long placeId) {
        placeCandidateRepository.deleteById(placeId);
    }
}
