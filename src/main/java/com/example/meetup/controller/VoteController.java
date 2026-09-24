package com.example.meetup.controller;

import com.example.meetup.entity.Vote;
import com.example.meetup.service.VoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/votes")
@RequiredArgsConstructor
public class VoteController {

    private final VoteService voteService;

    @PostMapping
    public Vote save(@RequestBody Vote vote) {
        return voteService.save(vote);
    }

    @GetMapping("/place/{placeId}")
    public List<Vote> findByPlaceId(@PathVariable Long placeId) {
        return voteService.findByPlaceId(placeId);
    }
}