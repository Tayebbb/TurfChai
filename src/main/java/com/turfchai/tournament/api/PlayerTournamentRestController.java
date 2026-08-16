package com.turfchai.tournament.api;

import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.AuthenticatedUser;
import com.turfchai.security.UserPrincipal;
import com.turfchai.tournament.service.TournamentRequests.RegisterPlayerRequest;
import com.turfchai.tournament.service.TournamentService;
import com.turfchai.tournament.service.TournamentViews.TeamView;
import com.turfchai.tournament.service.TournamentViews.TournamentCard;
import com.turfchai.tournament.service.TournamentViews.TournamentView;
import com.turfchai.venue.dto.PagedResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Player-facing tournament browse + registration.
 *
 * <p>The player is always the authenticated principal; a caller can neither
 * browse nor register as somebody else.
 */
@RestController
@RequestMapping("/api/v1/tournaments")
@SecurityRequirement(name = "bearerAuth")
@Validated
public class PlayerTournamentRestController {

    private final TournamentService tournamentService;
    private final UserRepository users;

    public PlayerTournamentRestController(TournamentService tournamentService, UserRepository users) {
        this.tournamentService = tournamentService;
        this.users = users;
    }

    private User currentUser(UserPrincipal principal) {
        Long id = AuthenticatedUser.requireId(principal);
        return users.findById(id)
                .orElseThrow(() -> new com.turfchai.exception.UnauthenticatedException("Authenticated user no longer exists"));
    }

    /** Browse tournaments open for registration. */
    @GetMapping
    public PagedResponse<TournamentCard> browse(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "true") boolean openOnly,
            @RequestParam(defaultValue = "true") boolean upcomingOnly,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(50) int size) {
        return tournamentService.browse(openOnly, upcomingOnly, currentUser(principal), page, size);
    }

    /** Tournaments the signed-in player has registered for. */
    @GetMapping("/me")
    public List<TournamentCard> myTournaments(@AuthenticationPrincipal UserPrincipal principal) {
        return tournamentService.myTournaments(currentUser(principal));
    }

    @GetMapping("/{code}")
    public TournamentView get(@AuthenticationPrincipal UserPrincipal principal, @PathVariable String code) {
        AuthenticatedUser.require(principal);
        return tournamentService.get(code);
    }

    /** Registers the player's team; the entry fee is recorded as DUE. */
    @PostMapping("/{code}/register")
    @ResponseStatus(HttpStatus.CREATED)
    public TeamView register(@PathVariable String code,
                             @AuthenticationPrincipal UserPrincipal principal,
                             @Valid @RequestBody RegisterPlayerRequest request) {
        return tournamentService.register(code, currentUser(principal), request);
    }

    @DeleteMapping("/{code}/register")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@PathVariable String code,
                         @AuthenticationPrincipal UserPrincipal principal) {
        tournamentService.withdraw(code, currentUser(principal));
    }
}
