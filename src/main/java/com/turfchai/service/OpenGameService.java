package com.turfchai.service;

import com.turfchai.dto.request.CreateOpenGameRequest;
import com.turfchai.dto.request.JoinOpenGameRequest;
import com.turfchai.dto.response.JoinOpenGameResponse;
import com.turfchai.dto.response.OpenGameMemberResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.model.enums.SkillLevel;

import java.time.LocalDate;
import java.util.List;

public interface OpenGameService {
    OpenGameResponse createOpenGame(CreateOpenGameRequest request);
    OpenGameResponse getOpenGameById(Long id);
    List<OpenGameResponse> searchOpenGames(SkillLevel skillLevel, LocalDate gameDate, String query);
    JoinOpenGameResponse joinOpenGame(Long openGameId, JoinOpenGameRequest request);
    List<OpenGameMemberResponse> getGameMembers(Long openGameId);
    void updateMemberAttendance(Long openGameId, Long userId, boolean showUp);
}
