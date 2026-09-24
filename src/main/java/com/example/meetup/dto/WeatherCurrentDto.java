package com.example.meetup.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class WeatherCurrentDto {

    @JsonProperty("temperature_2m")
    private Double temperature;

    @JsonProperty("relative_humidity_2m")
    private Integer humidity;

    @JsonProperty("precipitation")
    private Double precipitation;

    @JsonProperty("weather_code")
    private Integer weatherCode;

    @JsonProperty("wind_speed_10m")
    private Double windSpeed;
}
