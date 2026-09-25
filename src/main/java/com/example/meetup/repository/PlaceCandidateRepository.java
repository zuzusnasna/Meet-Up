package com.example.meetup.repository;

import com.example.meetup.entity.PlaceCandidate;
import com.example.meetup.dto.PlaceCandidateResponse;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaceCandidateRepository extends JpaRepository<PlaceCandidate, Long> {

    List<PlaceCandidate> findByRoomId(Long roomId);

    @Query("""
            select new com.example.meetup.dto.PlaceCandidateResponse(
                p.placeId,
                p.roomId,
                p.userId,
                u.name,
                p.placeName,
                p.address,
                p.latitude,
                p.longitude,
                p.kakaoPlaceId,
                p.createdAt
            )
            from PlaceCandidate p
            left join User u on p.userId = u.userId
            where p.roomId = :roomId
            order by p.placeId
            """)
    List<PlaceCandidateResponse> findResponsesByRoomId(@Param("roomId") Long roomId);

    long countByRoomIdAndUserId(Long roomId, Long userId);
}
