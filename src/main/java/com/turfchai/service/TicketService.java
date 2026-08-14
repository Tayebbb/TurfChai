package com.turfchai.service;

import com.turfchai.dto.response.CheckInResponse;
import com.turfchai.dto.response.TicketResponse;
import com.turfchai.exception.InvalidTicketException;
import com.turfchai.exception.OpenGameNotFoundException;
import com.turfchai.model.OpenGame;
import com.turfchai.model.OpenGameMembership;
import com.turfchai.model.enums.GameMembershipStatus;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.OpenGameMembershipRepository;
import com.turfchai.repository.OpenGameRepository;
import com.turfchai.service.CheckInTokenService.CheckInToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

/**
 * Match tickets for open games.
 *
 * <p>A ticket is not a stored row: it is the player's membership rendered for
 * the gate, plus a signed token bounded to the match's own gate window. Nothing
 * is minted for a player who is not on the roster, so a ticket cannot be
 * obtained by guessing a game id.
 */
@Service
public class TicketService {

    /** Gate window around kickoff — early enough to queue, closed after the match. */
    private static final Duration GATE_OPENS_BEFORE = Duration.ofHours(3);
    private static final Duration GATE_CLOSES_AFTER = Duration.ofHours(2);

    private final OpenGameRepository openGames;
    private final OpenGameMembershipRepository memberships;
    private final OpenGameService openGameService;
    private final CheckInTokenService tokens;
    private final ZoneId zone;

    public TicketService(OpenGameRepository openGames,
                         OpenGameMembershipRepository memberships,
                         OpenGameService openGameService,
                         CheckInTokenService tokens,
                         @Value("${app.timezone:Asia/Dhaka}") String timezone) {
        this.openGames = openGames;
        this.memberships = memberships;
        this.openGameService = openGameService;
        this.tokens = tokens;
        // Kickoff is stored as a local date/time, so the gate window is only
        // correct when resolved in the venue's zone, not the server's.
        this.zone = ZoneId.of(timezone);
    }

    /** The signed-in player's ticket for one game. */
    @Transactional(readOnly = true)
    public TicketResponse getTicket(Long gameId, Long userId) {
        OpenGame game = openGames.findById(gameId)
                .orElseThrow(() -> new OpenGameNotFoundException("Open game not found with id: " + gameId));
        OpenGameMembership membership = memberships.findByOpenGameIdAndUserId(gameId, userId)
                .orElseThrow(() -> new AccessDeniedException("You do not have a ticket for this game"));
        if (membership.getStatus() == GameMembershipStatus.CANCELLED) {
            throw new AccessDeniedException("Your spot on this game was cancelled");
        }

        Instant from = gateOpensAt(game);
        Instant until = gateClosesAt(game);
        String token = tokens.sign(new CheckInToken(game.getId(), userId, from, until));

        return TicketResponse.builder()
                .gameId(game.getId())
                .gameCode(game.getGameCode())
                .ticketCode(game.getGameCode() != null ? game.getGameCode() : "OG-" + game.getId())
                .title(game.getTitle())
                .venueName(game.getVenue() != null ? game.getVenue().getName() : null)
                .pitchName(game.getPitch() != null ? game.getPitch().getName() : null)
                .area(game.getVenue() != null ? game.getVenue().getArea() : null)
                .gameDate(game.getGameDate())
                .startTime(game.getStartTime())
                .endTime(game.getEndTime())
                .skillLevel(game.getSkillLevel() != null ? game.getSkillLevel().name() : SkillLevel.ALL_LEVELS.name())
                .pricePerPlayer(game.getPricePerPlayer())
                .capacity(game.getCapacity())
                .filledCount(game.getFilledCount())
                .organizerName(game.getOrganizer() != null ? game.getOrganizer().getFullName() : null)
                .holderUserId(userId)
                .holderName(membership.getUser().getFullName())
                .membershipStatus(membership.getStatus().name())
                .checkedIn(Boolean.TRUE.equals(membership.getShowUp()))
                .checkInToken(token)
                .validFrom(from)
                .validUntil(until)
                .build();
    }

    /**
     * Admits a scanned ticket and marks attendance. Every refusal throws, so
     * the scanner has exactly one success path and a message it can display.
     */
    @Transactional
    public CheckInResponse checkIn(String presentedToken) {
        CheckInToken token = tokens.verify(presentedToken)
                .orElseThrow(() -> new InvalidTicketException("This QR code is not a valid TurfChai ticket"));

        Instant now = Instant.now();
        if (now.isBefore(token.validFrom())) {
            throw new InvalidTicketException("This ticket is not valid yet — the gate opens closer to kickoff");
        }
        if (now.isAfter(token.validUntil())) {
            throw new InvalidTicketException("This ticket has expired");
        }

        OpenGame game = openGames.findById(token.gameId())
                .orElseThrow(() -> new InvalidTicketException("This ticket points at a game that no longer exists"));
        OpenGameMembership membership = memberships
                .findByOpenGameIdAndUserId(token.gameId(), token.userId())
                .orElseThrow(() -> new InvalidTicketException("The holder is no longer on this game's roster"));
        if (membership.getStatus() == GameMembershipStatus.CANCELLED) {
            throw new InvalidTicketException("The holder cancelled their spot on this game");
        }

        boolean repeat = Boolean.TRUE.equals(membership.getShowUp());
        if (!repeat) {
            openGameService.updateMemberAttendance(token.gameId(), token.userId(), true);
        }

        String name = membership.getUser().getFullName();
        return CheckInResponse.builder()
                .message(repeat ? name + " has already checked in" : name + " is checked in")
                .gameId(game.getId())
                .gameCode(game.getGameCode())
                .title(game.getTitle())
                .userId(token.userId())
                .holderName(name)
                .gameDate(game.getGameDate())
                .startTime(game.getStartTime())
                .build();
    }

    private Instant gateOpensAt(OpenGame game) {
        return game.getGameDate().atTime(game.getStartTime()).atZone(zone).toInstant()
                .minus(GATE_OPENS_BEFORE);
    }

    private Instant gateClosesAt(OpenGame game) {
        return game.getGameDate().atTime(game.getEndTime()).atZone(zone).toInstant()
                .plus(GATE_CLOSES_AFTER);
    }
}
