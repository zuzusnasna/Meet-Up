package com.example.meetup.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TourismItemDto {

    private String contentId;
    private String title;
    private String address;
    private String imageUrl;
    private String latitude;
    private String longitude;
    private String phone;
    private String startDate;
    private String endDate;
    private String placeUrl;
}
