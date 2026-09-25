package com.example.meetup.repository;

import com.example.meetup.entity.Location;
import com.example.meetup.dto.LocationResponse;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LocationRepository extends JpaRepository<Location, Long> {

    @Query("""
            select new com.example.meetup.dto.LocationResponse(
                l.locationId,
                l.userId,
                u.name,
                l.roomId,
                l.address,
                l.latitude,
                l.longitude,
                l.createdAt
            )
            from Location l, User u
            where l.userId = u.userId
              and l.roomId = :roomId
            order by l.locationId
            """)
    List<LocationResponse> findLocationResponsesByRoomId(@Param("roomId") Long roomId);

    List<Location> findByUserId(Long userId);

    Optional<Location> findByRoomIdAndUserId(Long roomId, Long userId);
}
