package com.turfchai.service.impl;

import com.turfchai.dto.request.CreateLfgAlertRequest;
import com.turfchai.dto.response.LfgAlertResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.exception.LfgAlertNotFoundException;
import com.turfchai.exception.UserNotFoundException;
import com.turfchai.model.LfgAlert;
import com.turfchai.model.OpenGame;
import com.turfchai.model.User;
import com.turfchai.model.enums.LfgStatus;
import com.turfchai.model.enums.OpenGameStatus;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.LfgAlertRepository;
import com.turfchai.repository.OpenGameRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.service.LfgAlertService;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.repository.SportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LfgAlertServiceImpl implements LfgAlertService {

    private final LfgAlertRepository alertRepository;
    private final UserRepository userRepository;
    private final SportRepository sportRepository;
    private final OpenGameRepository openGameRepository;

    @Override
    @Transactional
    public LfgAlertResponse createAlert(Long ownerId, CreateLfgAlertRequest request) {
        User user = userRepository.findById(ownerId)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + ownerId));

        Sport sport = null;
        if (request.getSportId() != null) {
            sport = sportRepository.findById(request.getSportId()).orElse(null);
        } else if (request.getSportName() != null && !request.getSportName().isBlank()) {
            sport = sportRepository.findByNameIgnoreCase(request.getSportName().replaceAll("[^a-zA-Z]", "").trim()).orElse(null);
        }

        LfgAlert alert = LfgAlert.builder()
                .user(user)
                .sport(sport)
                .area(request.getArea())
                .preferredDays(request.getPreferredDays())
                .preferredFrom(request.getPreferredFrom())
                .preferredTo(request.getPreferredTo())
                .skillLevel(request.getSkillLevel() != null ? request.getSkillLevel() : SkillLevel.ALL_LEVELS)
                .status(LfgStatus.ACTIVE)
                .build();

        LfgAlert savedAlert = alertRepository.save(alert);
        return mapToLfgAlertResponse(savedAlert);
    }

    @Override
    @Transactional(readOnly = true)
    public List<LfgAlertResponse> getUserAlerts(Long ownerId) {
        List<LfgAlert> alerts = alertRepository.findByUserId(ownerId);
        return alerts.stream().map(this::mapToLfgAlertResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public LfgAlertResponse updateAlertStatus(Long alertId, Long callerId, LfgStatus status) {
        LfgAlert alert = requireOwned(alertId, callerId);
        alert.setStatus(status);
        LfgAlert updated = alertRepository.save(alert);
        return mapToLfgAlertResponse(updated);
    }

    @Override
    @Transactional
    public void deleteAlert(Long alertId, Long callerId) {
        alertRepository.delete(requireOwned(alertId, callerId));
    }

    /**
     * Loads an alert the caller owns.
     *
     * <p>Someone else's alert reports as missing rather than forbidden: a 403
     * would confirm that the id exists, which is exactly what an id-guessing
     * probe is looking for.
     */
    private LfgAlert requireOwned(Long alertId, Long callerId) {
        LfgAlert alert = alertRepository.findById(alertId)
                .filter(a -> a.getUser().getId().equals(callerId))
                .orElseThrow(() -> new LfgAlertNotFoundException("LFG alert not found with id: " + alertId));
        return alert;
    }

    @Override
    @Transactional
    public List<OpenGameResponse> findMatchesForAlert(Long alertId, Long callerId) {
        LfgAlert alert = requireOwned(alertId, callerId);

        List<OpenGame> openGames = openGameRepository.findByStatusIn(List.of(OpenGameStatus.OPEN, OpenGameStatus.ALMOST_FULL));

        List<OpenGame> matchedGames = openGames.stream().filter(game -> {
            String gameArea = game.getVenue() == null ? null : game.getVenue().getArea();
            if (gameArea != null && !areasOverlap(gameArea, alert.getArea())) {
                return false;
            }
            if (alert.getSkillLevel() != null && alert.getSkillLevel() != SkillLevel.ALL_LEVELS
                    && game.getSkillLevel() != SkillLevel.ALL_LEVELS && game.getSkillLevel() != alert.getSkillLevel()) {
                return false;
            }
            if (alert.getPreferredFrom() != null && game.getStartTime().isBefore(alert.getPreferredFrom())) {
                return false;
            }
            if (alert.getPreferredTo() != null && game.getEndTime().isAfter(alert.getPreferredTo())) {
                return false;
            }
            return true;
        }).collect(Collectors.toList());

        if (!matchedGames.isEmpty()) {
            alert.setLastMatchedAt(OffsetDateTime.now());
            alertRepository.save(alert);
        }

        return matchedGames.stream().map(game -> OpenGameResponse.builder()
                .id(game.getId())
                .gameCode(game.getGameCode())
                .title(game.getTitle())
                .venueId(game.getVenue() != null ? game.getVenue().getId() : null)
                .venueName(game.getVenue() != null ? game.getVenue().getName() : null)
                .area(game.getVenue() != null ? game.getVenue().getArea() : null)
                .gameDate(game.getGameDate())
                .startTime(game.getStartTime())
                .endTime(game.getEndTime())
                .skillLevel(game.getSkillLevel() != null ? game.getSkillLevel().name() : SkillLevel.ALL_LEVELS.name())
                .capacity(game.getCapacity())
                .filledCount(game.getFilledCount())
                .spotsLeft(Math.max(0, game.getCapacity() - game.getFilledCount()))
                .pricePerPlayer(game.getPricePerPlayer())
                .status(game.getStatus().name())
                .build()).collect(Collectors.toList());
    }

    /** Areas match when either name contains the other, e.g. "Mirpur" vs "Mirpur DOHS". */
    private static boolean areasOverlap(String gameArea, String alertArea) {
        if (alertArea == null || alertArea.isBlank()) {
            return true;
        }
        String a = gameArea.toLowerCase();
        String b = alertArea.toLowerCase();
        return a.contains(b) || b.contains(a);
    }

    private LfgAlertResponse mapToLfgAlertResponse(LfgAlert alert) {
        return LfgAlertResponse.builder()
                .id(alert.getId())
                .userId(alert.getUser().getId())
                .sportId(alert.getSport() != null ? alert.getSport().getId() : null)
                .sportName(alert.getSport() != null ? alert.getSport().getName() : null)
                .area(alert.getArea())
                .preferredDays(alert.getPreferredDays())
                .preferredFrom(alert.getPreferredFrom())
                .preferredTo(alert.getPreferredTo())
                .skillLevel(alert.getSkillLevel() != null ? alert.getSkillLevel().name() : SkillLevel.ALL_LEVELS.name())
                .status(alert.getStatus().name())
                .lastMatchedAt(alert.getLastMatchedAt())
                .createdAt(alert.getCreatedAt())
                .build();
    }
}
