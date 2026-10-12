package com.example.meetup.controller;

import com.example.meetup.dto.VoteFinishResponse;
import com.example.meetup.service.VoteFinishService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/rooms")
@RequiredArgsConstructor
public class VoteFinishController {

    private final VoteFinishService voteFinishService;

    @PostMapping("/{roomId}/vote-finish")
    public VoteFinishResponse finishVote(
            @PathVariable Long roomId,
            @RequestParam Long userId
    ) {
        return voteFinishService.finish(roomId, userId);
    }

    @GetMapping("/{roomId}/vote-result")
    public VoteFinishResponse getVoteResult(@PathVariable Long roomId) {
        return voteFinishService.getResult(roomId);
    }
}
