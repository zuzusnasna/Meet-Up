package com.example.meetup.controller;

import com.example.meetup.service.BusTransitService;
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

    private final BusTransitService busTransitService;
    private final com.example.meetup.service.KakaoTransitRouteService kakaoTransitRouteService;

    @GetMapping("/return-routes")
    public Map<String, Object> findReturnRoutes(
            @RequestParam double meetingLatitude,
            @RequestParam double meetingLongitude,
            @RequestParam double originLatitude,
            @RequestParam double originLongitude
    ) {
        return kakaoTransitRouteService.findReturnRoutes(
                meetingLatitude, meetingLongitude, originLatitude, originLongitude);
    }

    @GetMapping("/bus-arrivals")
    public Map<String, Object> findBusArrivals(@RequestParam double latitude, @RequestParam double longitude) {
        return busTransitService.findBusArrivals(latitude, longitude);
    }
}
