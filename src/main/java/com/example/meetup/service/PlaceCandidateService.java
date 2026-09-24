package com.example.meetup.service;

import com.example.meetup.entity.PlaceCandidate;
import com.example.meetup.repository.PlaceCandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PlaceCandidateService {

    private final PlaceCandidateRepository placeCandidateRepository;

    public PlaceCandidate save(PlaceCandidate placeCandidate) {
        return placeCandidateRepository.save(placeCandidate);
    }

    public List<PlaceCandidate> findByRoomId(Long roomId) {
        return placeCandidateRepository.findByRoomId(roomId);
    }

    public void delete(Long placeId) {
        placeCandidateRepository.deleteById(placeId);
    }
}
