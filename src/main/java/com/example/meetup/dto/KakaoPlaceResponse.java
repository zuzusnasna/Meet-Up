package com.example.meetup.dto;

import lombok.Data;

import java.util.List;

@Data
public class KakaoPlaceResponse {

    private List<KakaoPlaceDto> documents;
}
