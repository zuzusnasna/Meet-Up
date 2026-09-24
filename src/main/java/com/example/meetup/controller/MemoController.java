package com.example.meetup.controller;

import com.example.meetup.entity.Memo;
import com.example.meetup.service.MemoService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/memos")
@RequiredArgsConstructor
public class MemoController {

    private final MemoService memoService;

    @PostMapping
    public Memo save(@RequestBody Memo memo) {
        return memoService.save(memo);
    }

    @GetMapping("/place/{placeId}")
    public List<Memo> findByPlaceId(@PathVariable Long placeId) {
        return memoService.findByPlaceId(placeId);
    }

    @DeleteMapping("/{memoId}")
    public void delete(@PathVariable Long memoId) {
        memoService.delete(memoId);
    }
}
