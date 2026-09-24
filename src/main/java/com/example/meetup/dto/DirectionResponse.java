package com.example.meetup.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class DirectionResponse {

    private int distance;
    private int duration;
    private String originName;
    private String destinationName;
}
