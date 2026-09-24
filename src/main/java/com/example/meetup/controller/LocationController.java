package com.example.meetup.controller;

import com.example.meetup.entity.Location;
import com.example.meetup.service.LocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    @PostMapping
    public Location save(@RequestBody Location location) {
        return locationService.save(location);
    }

    @GetMapping("/room/{roomId}")
    public List<Location> findByRoomId(@PathVariable Long roomId) {
        return locationService.findByRoomId(roomId);
    }

    @GetMapping("/user/{userId}")
    public List<Location> findByUserId(@PathVariable Long userId) {
        return locationService.findByUserId(userId);
    }

    @DeleteMapping("/{locationId}")
    public void delete(@PathVariable Long locationId) {
        locationService.delete(locationId);
    }
}
