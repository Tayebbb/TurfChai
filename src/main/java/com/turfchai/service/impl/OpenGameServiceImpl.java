package com.turfchai.service.impl;

import com.turfchai.dto.request.CreateOpenGameRequest;
import com.turfchai.dto.request.JoinOpenGameRequest;
import com.turfchai.dto.response.JoinOpenGameResponse;
import com.turfchai.dto.response.OpenGameMemberResponse;
import com.turfchai.dto.response.OpenGameResponse;
import com.turfchai.exception.*;
import com.turfchai.model.*;
import com.turfchai.model.enums.GameMembershipStatus;
import com.turfchai.model.enums.OpenGameStatus;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.*;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import com.turfchai.service.OpenGameService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OpenGameServiceImpl implements OpenGameService {

    private final OpenGameRepository openGameRepository;
    private final OpenGameMembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final com.turfchai.booking.repository.BookingRepository bookingRepository;

    @Override
    @Transactional
    public OpenGameResponse createOpenGame(CreateOpenGameRequest request, Long organizerUserId) {
        if (request.getEndTime() == null || request.getStartTime() == null || request.getEndTime().equals(request.getStartTime())) {
            throw new InvalidGameStateException("Start time and end time cannot be empty or equal");
        }

        Venue venue = venueRepository.findById(request.getVenueId())
                .orElseThrow(() -> new VenueNotFoundException("Venue not found with id: " + request.getVenueId()));

        // Organizer is the authenticated caller; request.organizerUserId is ignored.
        User organizer = userRepository.findById(organizerUserId)
                .orElseThrow(() -> new UserNotFoundException("Organizer not found with id: " + organizerUserId));

        Pitch pitch = null;
        if (request.getPitchId() != null) {
            pitch = pitchRepository.findById(request.getPitchId()).orElse(null);
        }

        SkillLevel skillLevel = request.getSkillLevel() != null ? request.getSkillLevel() : SkillLevel.ALL_LEVELS;

        int initialFilled = 1;
        if (request.getReservedSpots() != null && request.getReservedSpots() >= 1) {
            initialFilled = Math.min(request.getReservedSpots(), request.getCapacity());
        }

        OpenGame openGame = OpenGame.builder()
                .title(request.getTitle())
                .venue(venue)
                .pitch(pitch)
                .gameDate(request.getGameDate())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .skillLevel(skillLevel)
                .capacity(request.getCapacity())
                .filledCount(initialFilled)
                .pricePerPlayer(request.getPricePerPlayer())
                .organizer(organizer)
                .status(OpenGameStatus.OPEN)
                .minimumReliability(request.getMinimumReliability() != null ? request.getMinimumReliability() : 90)
                .build();

        openGame.updateStatusBasedOnCapacity();
        OpenGame savedGame = openGameRepository.save(openGame);

        OpenGameMembership organizerMembership = OpenGameMembership.builder()
                .openGame(savedGame)
                .user(organizer)
                .status(GameMembershipStatus.JOINED)
                .build();

        membershipRepository.save(organizerMembership);

        // If created from a booking, link the open game back to the booking
        if (request.getBookingId() != null) {
            bookingRepository.findById(request.getBookingId()).ifPresent(b -> {
                if (b.getUserId().equals(organizerUserId)) {
                    b.setOpenGameId(savedGame.getId());
                    bookingRepository.save(b);
                }
            });
        }

        return mapToOpenGameResponse(savedGame);
    }

    @Override
    @Transactional(readOnly = true)
    public OpenGameResponse getOpenGameById(Long id) {
        OpenGame game = openGameRepository.findById(id)
                .orElseThrow(() -> new OpenGameNotFoundException("Open game not found with id: " + id));
        return mapToOpenGameResponse(game);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OpenGameResponse> searchOpenGames(SkillLevel skillLevel, LocalDate gameDate, String query) {
        List<OpenGame> games = openGameRepository.searchOpenGames(skillLevel, gameDate, query);
        return games.stream().map(this::mapToOpenGameResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public JoinOpenGameResponse joinOpenGame(Long openGameId, JoinOpenGameRequest request, Long joiningUserId) {
        OpenGame game = openGameRepository.findWithLockById(openGameId)
                .orElseThrow(() -> new OpenGameNotFoundException("Open game not found with id: " + openGameId));

        if (game.getStatus() == OpenGameStatus.CANCELLED || game.getStatus() == OpenGameStatus.COMPLETED) {
            throw new InvalidGameStateException("Game is no longer active");
        }

        if (game.getFilledCount() >= game.getCapacity() || game.getStatus() == OpenGameStatus.FULL) {
            throw new GameFullException("Game is already full");
        }

        // The joining player is the authenticated caller; request.userId is ignored,
        // otherwise a caller could enrol somebody else and bill them for a share.
        if (membershipRepository.existsByOpenGameIdAndUserId(openGameId, joiningUserId)) {
            throw new AlreadyJoinedException("User has already joined this game");
        }

        User user = userRepository.findById(joiningUserId)
                .orElseThrow(() -> new UserNotFoundException("User not found with id: " + joiningUserId));

        if (user.getReliabilityScore() < game.getMinimumReliability()) {
            throw new LowReliabilityScoreException(
                    "Your reliability score (" + user.getReliabilityScore() + "%) is below the game minimum ("
                            + game.getMinimumReliability() + "%)");
        }

        validateSkillLevel(game.getSkillLevel(), user.getPlayStyle());

        game.setFilledCount(game.getFilledCount() + 1);
        game.updateStatusBasedOnCapacity();
        openGameRepository.save(game);

        OpenGameMembership membership = OpenGameMembership.builder()
                .openGame(game)
                .user(user)
                .status(GameMembershipStatus.JOINED)
                .build();

        OpenGameMembership savedMembership = membershipRepository.save(membership);

        return JoinOpenGameResponse.builder()
                .success(true)
                .message("Successfully joined the game")
                .membershipId(savedMembership.getId())
                .openGameId(game.getId())
                .filledCount(game.getFilledCount())
                .capacity(game.getCapacity())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OpenGameMemberResponse> getGameMembers(Long openGameId) {
        if (!openGameRepository.existsById(openGameId)) {
            throw new OpenGameNotFoundException("Open game not found with id: " + openGameId);
        }
        List<OpenGameMembership> memberships = membershipRepository.findByOpenGameId(openGameId);
        return memberships.stream().map(this::mapToMemberResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void updateMemberAttendance(Long openGameId, Long userId, boolean showUp) {
        OpenGameMembership membership = membershipRepository.findByOpenGameIdAndUserId(openGameId, userId)
                .orElseThrow(() -> new OpenGameNotFoundException(
                        "Membership not found for game: " + openGameId + " and user: " + userId));

        membership.setShowUp(showUp);
        membershipRepository.save(membership);

        User user = membership.getUser();
        if (showUp) {
            user.setGamesAttended(user.getGamesAttended() + 1);
            user.setReliabilityScore(Math.min(100, user.getReliabilityScore() + 1));
        } else {
            user.setGamesNoShow(user.getGamesNoShow() + 1);
            user.setReliabilityScore(Math.max(0, user.getReliabilityScore() - 10));
        }
        userRepository.save(user);
    }

    private void validateSkillLevel(SkillLevel requiredLevel, SkillLevel userLevel) {
        if (requiredLevel == null || requiredLevel == SkillLevel.ALL_LEVELS) {
            return;
        }
        if (userLevel != null && userLevel != SkillLevel.ALL_LEVELS && userLevel != requiredLevel) {
            throw new InvalidSkillLevelException(
                    "Required skill level is " + requiredLevel.getLabel() + ", but user is " + userLevel.getLabel());
        }
    }

    private OpenGameResponse mapToOpenGameResponse(OpenGame game) {
        int spotsLeft = Math.max(0, game.getCapacity() - game.getFilledCount());
        List<OpenGameMemberResponse> members = game.getMemberships() != null
                ? game.getMemberships().stream().map(this::mapToMemberResponse).collect(Collectors.toList())
                : List.of();

        return OpenGameResponse.builder()
                .id(game.getId())
                .gameCode(game.getGameCode())
                .title(game.getTitle())
                .venueId(game.getVenue() != null ? game.getVenue().getId() : null)
                .venueName(game.getVenue() != null ? game.getVenue().getName() : null)
                .area(game.getVenue() != null ? game.getVenue().getArea() : null)
                .pitchId(game.getPitch() != null ? game.getPitch().getId() : null)
                .pitchName(game.getPitch() != null ? game.getPitch().getName() : null)
                .gameDate(game.getGameDate())
                .startTime(game.getStartTime())
                .endTime(game.getEndTime())
                .skillLevel(game.getSkillLevel() != null ? game.getSkillLevel().name() : SkillLevel.ALL_LEVELS.name())
                .capacity(game.getCapacity())
                .filledCount(game.getFilledCount())
                .spotsLeft(spotsLeft)
                .pricePerPlayer(game.getPricePerPlayer())
                .organizerId(game.getOrganizer() != null ? game.getOrganizer().getId() : null)
                .organizerName(game.getOrganizer() != null ? game.getOrganizer().getFullName() : null)
                .status(game.getStatus() != null ? game.getStatus().name() : OpenGameStatus.OPEN.name())
                .minimumReliability(game.getMinimumReliability())
                .members(members)
                .build();
    }

    private OpenGameMemberResponse mapToMemberResponse(OpenGameMembership membership) {
        User u = membership.getUser();
        return OpenGameMemberResponse.builder()
                .id(membership.getId())
                .userId(u.getId())
                .name(u.getFullName())
                .initials(u.getAvatarInitials() != null ? u.getAvatarInitials() : getInitials(u.getFullName()))
                .avatarUrl(u.getAvatarUrl())
                .reliabilityScore(u.getReliabilityScore())
                .status(membership.getStatus() != null ? membership.getStatus().name()
                        : GameMembershipStatus.JOINED.name())
                .showUp(membership.getShowUp())
                .joinedAt(membership.getJoinedAt())
                .build();
    }

    private String getInitials(String fullName) {
        if (fullName == null || fullName.isBlank())
            return "??";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1)
            return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    }
}
