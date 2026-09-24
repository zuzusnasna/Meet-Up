package com.example.meetup.repository;

import com.example.meetup.entity.Memo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemoRepository extends JpaRepository<Memo, Long> {

    List<Memo> findByPlaceId(Long placeId);
}
