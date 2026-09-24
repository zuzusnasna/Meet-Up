package com.example.meetup.controller;

import com.example.meetup.dto.DirectionResponse;
import com.example.meetup.service.DirectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/directions")
@RequiredArgsConstructor
public class DirectionController {

    private final DirectionService directionService;

    @GetMapping
    public DirectionResponse getDirection(
            @RequestParam double originLatitude,
            @RequestParam double originLongitude,
            @RequestParam double destinationLatitude,
            @RequestParam double destinationLongitude
    ) {
        return directionService.getDirection(
                originLatitude,
                originLongitude,
                destinationLatitude,
                destinationLongitude
        );
    }
}
