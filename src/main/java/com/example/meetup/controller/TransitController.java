package com.example.meetup.controller;

import com.example.meetup.dto.TransitBatchRequest;
import com.example.meetup.service.BusTransitService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
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
            @RequestParam double originLongitude,
            @RequestParam(defaultValue = "false") boolean refresh,
            @RequestParam(defaultValue = "time") String mode
    ) {
        return kakaoTransitRouteService.findReturnRoutes(
                meetingLatitude, meetingLongitude, originLatitude, originLongitude, refresh, mode);
    }

    @PostMapping("/return-routes/batch")
    public Map<String, Object> findReturnRoutesBatch(@RequestBody TransitBatchRequest request) {
        Map<String, Object> results = new LinkedHashMap<>();
        if (request.origins() == null) return results;

        for (TransitBatchRequest.Origin origin : request.origins()) {
            if (origin == null || origin.userId() == null) continue;
            results.put(String.valueOf(origin.userId()),
                    kakaoTransitRouteService.findReturnRoutes(
                            request.meetingLatitude(), request.meetingLongitude(),
                            origin.latitude(), origin.longitude(), request.refresh(), request.mode()));
        }
        return results;
    }

    @GetMapping("/bus-arrivals")
    public Map<String, Object> findBusArrivals(@RequestParam double latitude, @RequestParam double longitude) {
        return busTransitService.findBusArrivals(latitude, longitude);
    }
}
