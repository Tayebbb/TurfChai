package com.turfchai.controller;

import com.turfchai.dto.request.CreateOpenGameRequest;
import com.turfchai.dto.request.JoinOpenGameRequest;
import com.turfchai.dto.response.JoinOpenGameResponse;
import com.turfchai.dto.response.OpenGameMemberResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.service.OpenGameService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/solo/open-games")
@RequiredArgsConstructor
public class OpenGameRestController {

    private final OpenGameService openGameService;

    @PostMapping
    public ResponseEntity<OpenGameResponse> createOpenGame(@Valid @RequestBody CreateOpenGameRequest request) {
        OpenGameResponse response = openGameService.createOpenGame(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<OpenGameResponse>> searchOpenGames(
            @RequestParam(required = false) SkillLevel skillLevel,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate gameDate,
            @RequestParam(required = false) String query) {
        List<OpenGameResponse> games = openGameService.searchOpenGames(skillLevel, gameDate, query);
        return ResponseEntity.ok(games);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OpenGameResponse> getOpenGameById(@PathVariable Long id) {
        OpenGameResponse game = openGameService.getOpenGameById(id);
        return ResponseEntity.ok(game);
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<OpenGameMemberResponse>> getGameMembers(@PathVariable Long id) {
        List<OpenGameMemberResponse> members = openGameService.getGameMembers(id);
        return ResponseEntity.ok(members);
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<JoinOpenGameResponse> joinOpenGame(
            @PathVariable Long id,
            @Valid @RequestBody JoinOpenGameRequest request) {
        JoinOpenGameResponse response = openGameService.joinOpenGame(id, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/members/{userId}/attendance")
    public ResponseEntity<Void> updateAttendance(
            @PathVariable Long id,
            @PathVariable Long userId,
            @RequestParam boolean showUp) {
        openGameService.updateMemberAttendance(id, userId, showUp);
        return ResponseEntity.ok().build();
    }
}
