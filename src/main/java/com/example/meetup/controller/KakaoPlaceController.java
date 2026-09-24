package com.example.meetup.controller;

import com.example.meetup.dto.KakaoPlaceResponse;
import com.example.meetup.service.KakaoPlaceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/kakao")
@RequiredArgsConstructor
public class KakaoPlaceController {

    private final KakaoPlaceService kakaoPlaceService;

    // 카카오 장소 검색
    @GetMapping("/places")
    public KakaoPlaceResponse searchPlace(
            @RequestParam String query
    ) {
        return kakaoPlaceService.searchPlace(query);
    }
}
