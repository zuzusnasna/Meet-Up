package com.example.meetup.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class KakaoPlaceDto {

    private String id;

    @JsonProperty("place_name")
    private String placeName;

    @JsonProperty("address_name")
    private String addressName;

    @JsonProperty("road_address_name")
    private String roadAddressName;

    private String x;

    private String y;

    private String phone;

    @JsonProperty("place_url")
    private String placeUrl;
}