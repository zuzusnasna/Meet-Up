package com.example.meetup.controller;

import com.example.meetup.dto.WeatherResponse;
import com.example.meetup.service.WeatherService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/weather")
@RequiredArgsConstructor
public class WeatherController {

    private final WeatherService weatherService;

    @GetMapping
    public WeatherResponse getCurrentWeather(
            @RequestParam double latitude,
            @RequestParam double longitude
    ) {
        return weatherService.getCurrentWeather(latitude, longitude);
    }
}
