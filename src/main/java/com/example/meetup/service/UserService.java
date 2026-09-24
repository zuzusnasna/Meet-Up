package com.example.meetup.service;

import com.example.meetup.entity.User;
import com.example.meetup.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    // 회원 저장
    public User saveUser(User user) {
        return userRepository.save(user);
    }

    // 회원 ID로 조회
    public Optional<User> findById(Long userId) {
        return userRepository.findById(userId);
    }

    // 소셜 ID + 제공자로 회원 조회
    public Optional<User> findBySocialIdAndProvider(
            String socialId,
            String provider
    ) {
        return userRepository.findBySocialIdAndProvider(socialId, provider);
    }

    // 전체 회원 조회
    public java.util.List<User> findAll() {
        return userRepository.findAll();
    }

    // 회원 삭제
    public void deleteUser(Long userId) {
        userRepository.deleteById(userId);
    }
}