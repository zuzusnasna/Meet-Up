package com.example.meetup.dto;

import java.util.List;

public record TransitBatchRequest(
        double meetingLatitude,
        double meetingLongitude,
        List<Origin> origins
) {
    public record Origin(
            Long userId,
            double latitude,
            double longitude
    ) {}
}
