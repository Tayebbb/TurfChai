package com.turfchai.tournament.api;

import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.tournament.service.TournamentRequests.RegisterPlayerRequest;
import com.turfchai.tournament.service.TournamentService;
import com.turfchai.tournament.service.TournamentViews.TeamView;
import com.turfchai.tournament.service.TournamentViews.TournamentCard;
import com.turfchai.tournament.service.TournamentViews.TournamentView;
import com.turfchai.venue.dto.PagedResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Player-facing tournament browse + registration.
 *
 * <p>TEMPORARY IDENTITY: same interim {@code X-User-Id} header as the rest of
 * the player API; it becomes the JWT principal at {@link #currentUser}.
 */
@RestController
@RequestMapping("/api/v1/tournaments")
@Validated
public class PlayerTournamentRestController {

    private final TournamentService tournamentService;
    private final UserRepository users;

    public PlayerTournamentRestController(TournamentService tournamentService, UserRepository users) {
        this.tournamentService = tournamentService;
        this.users = users;
    }

    private User currentUser(String header) {
        UUID id;
        if (header == null || header.isBlank()) {
            id = TournamentRestController.DEMO_USER_ID;
        } else {
            try {
                id = UUID.fromString(header.trim());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("X-User-Id must be a UUID");
            }
        }
        return users.findByPublicId(id.toString())
                .orElseThrow(() -> new IllegalArgumentException("Unknown user: " + id));
    }

    /** Browse tournaments open for registration. */
    @GetMapping
    public PagedResponse<TournamentCard> browse(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader,
            @RequestParam(defaultValue = "true") boolean openOnly,
            @RequestParam(defaultValue = "true") boolean upcomingOnly,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(50) int size) {
        return tournamentService.browse(openOnly, upcomingOnly, currentUser(userHeader), page, size);
    }

    /** Tournaments the signed-in player has registered for. */
    @GetMapping("/me")
    public List<TournamentCard> myTournaments(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader) {
        return tournamentService.myTournaments(currentUser(userHeader));
    }

    @GetMapping("/{code}")
    public TournamentView get(@PathVariable String code) {
        return tournamentService.get(code);
    }

    /** Registers the player's team; the entry fee is recorded as DUE. */
    @PostMapping("/{code}/register")
    @ResponseStatus(HttpStatus.CREATED)
    public TeamView register(@PathVariable String code,
                             @RequestHeader(value = "X-User-Id", required = false) String userHeader,
                             @Valid @RequestBody RegisterPlayerRequest request) {
        return tournamentService.register(code, currentUser(userHeader), request);
    }

    @DeleteMapping("/{code}/register")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@PathVariable String code,
                         @RequestHeader(value = "X-User-Id", required = false) String userHeader) {
        tournamentService.withdraw(code, currentUser(userHeader));
    }
}
