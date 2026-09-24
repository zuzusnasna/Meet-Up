package com.example.meetup.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class KakaoPlaceResponse {

    private List<KakaoPlaceDto> documents;
}
