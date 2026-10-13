package com.example.meetup.controller;

import com.example.meetup.service.TransitService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/transit")
@RequiredArgsConstructor
public class TransitController {

    private final TransitService transitService;

    @GetMapping("/last-train")
    public Map<String, Object> findLastTrain(
            @RequestParam double originLatitude,
            @RequestParam double originLongitude,
            @RequestParam double destinationLatitude,
            @RequestParam double destinationLongitude,
            @RequestParam(required = false) String dayType
    ) {
        return transitService.findLastTrain(
                originLatitude,
                originLongitude,
                destinationLatitude,
                destinationLongitude,
                dayType
        );
    }
}
