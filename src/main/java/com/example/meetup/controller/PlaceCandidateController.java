package com.example.meetup.controller;

import com.example.meetup.entity.PlaceCandidate;
import com.example.meetup.dto.PlaceCandidateResponse;
import com.example.meetup.service.PlaceCandidateService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/place-candidates")
@RequiredArgsConstructor
public class PlaceCandidateController {

    private final PlaceCandidateService placeCandidateService;

    @PostMapping
    public PlaceCandidate save(@RequestBody PlaceCandidate placeCandidate) {
        return placeCandidateService.save(placeCandidate);
    }

    @GetMapping("/room/{roomId}")
    public List<PlaceCandidateResponse> findByRoomId(@PathVariable Long roomId) {
        return placeCandidateService.findByRoomId(roomId);
    }

    @DeleteMapping("/{placeId}")
    public void delete(@PathVariable Long placeId) {
        placeCandidateService.delete(placeId);
    }
}
