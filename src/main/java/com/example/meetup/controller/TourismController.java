package com.example.meetup.controller;

import com.example.meetup.dto.TourismResponseDto;
import com.example.meetup.service.TourismService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tourism")
@RequiredArgsConstructor
public class TourismController {

    private final TourismService tourismService;

    @GetMapping
    public TourismResponseDto searchNearby(
            @RequestParam double latitude,
            @RequestParam double longitude,
            @RequestParam String category
    ) {
        return tourismService.searchNearby(latitude, longitude, category);
    }
}
