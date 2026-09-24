package com.example.meetup.service;

import com.example.meetup.entity.Location;
import com.example.meetup.repository.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;

    public Location save(Location location) {
        location.setCreatedAt(LocalDateTime.now());
        return locationRepository.save(location);
    }

    public List<Location> findByRoomId(Long roomId) {
        return locationRepository.findByRoomId(roomId);
    }

    public List<Location> findByUserId(Long userId) {
        return locationRepository.findByUserId(userId);
    }

    public void delete(Long locationId) {
        locationRepository.deleteById(locationId);
    }
}
