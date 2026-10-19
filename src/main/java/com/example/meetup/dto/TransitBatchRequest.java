package com.example.meetup.dto;

import java.util.List;

public record TransitBatchRequest(
        double meetingLatitude,
        double meetingLongitude,
        List<Origin> origins,
        boolean refresh,
        String mode
) {
    public record Origin(
            Long userId,
            double latitude,
            double longitude
    ) {}
}
