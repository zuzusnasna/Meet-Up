package com.example.meetup.service;

import com.example.meetup.entity.Memo;
import com.example.meetup.repository.MemoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MemoService {

    private final MemoRepository memoRepository;

    public Memo save(Memo memo) {
        memo.setCreatedAt(LocalDateTime.now());
        return memoRepository.save(memo);
    }

    public List<Memo> findByRoomId(Long roomId) {
        return memoRepository.findByRoomId(roomId);
    }

    public void delete(Long memoId) {
        memoRepository.deleteById(memoId);
    }
}
