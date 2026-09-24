package com.example.meetup.controller;

import com.example.meetup.entity.User;
import com.example.meetup.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // 회원 등록
    @PostMapping
    public User saveUser(@RequestBody User user) {
        return userService.saveUser(user);
    }

    // 전체 회원 조회
    @GetMapping
    public List<User> findAll() {
        return userService.findAll();
    }

    // 회원 한 명 조회
    @GetMapping("/{userId}")
    public Optional<User> findById(@PathVariable Long userId) {
        return userService.findById(userId);
    }

    // 소셜 로그인 회원 조회
    @GetMapping("/social")
    public Optional<User> findBySocialIdAndProvider(
            @RequestParam String socialId,
            @RequestParam String provider
    ) {
        return userService.findBySocialIdAndProvider(socialId, provider);
    }

    // 회원 삭제
    @DeleteMapping("/{userId}")
    public void deleteUser(@PathVariable Long userId) {
        userService.deleteUser(userId);
    }
}