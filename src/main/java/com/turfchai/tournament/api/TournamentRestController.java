package com.turfchai.tournament.api;

import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.AuthenticatedUser;
import com.turfchai.security.UserPrincipal;
import com.turfchai.tournament.service.TournamentRequests.CreateTournamentRequest;
import com.turfchai.tournament.service.TournamentRequests.PayBalanceRequest;
import com.turfchai.tournament.service.TournamentRequests.PayDepositRequest;
import com.turfchai.tournament.service.TournamentRequests.RegisterTeamRequest;
import com.turfchai.tournament.service.TournamentRequests.ReserveSlotsRequest;
import com.turfchai.tournament.service.TournamentRequests.UpdateTournamentSettingsRequest;
import com.turfchai.tournament.service.TournamentService;
import com.turfchai.tournament.service.TournamentViews.FixtureView;
import com.turfchai.tournament.service.TournamentViews.ReservationQuote;
import com.turfchai.tournament.service.TournamentViews.TeamView;
import com.turfchai.tournament.service.TournamentViews.TournamentView;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

/**
 * Host tournament hub.
 *
 * <p>
 * The host is always the authenticated principal. Every operation that reads
 * or mutates an existing tournament additionally verifies that the caller is
 * that tournament's host, so knowing a tournament code grants nothing.
 */
@RestController
@RequestMapping("/api/v1/host/tournaments")
@SecurityRequirement(name = "bearerAuth")
public class TournamentRestController {

    private final TournamentService tournamentService;
    private final UserRepository users;

    public TournamentRestController(TournamentService tournamentService, UserRepository users) {
        this.tournamentService = tournamentService;
        this.users = users;
    }

    private User currentUser(UserPrincipal principal) {
        Long id = AuthenticatedUser.requireId(principal);
        return users.findById(id)
                .orElseThrow(() -> new com.turfchai.exception.UnauthenticatedException(
                        "Authenticated user no longer exists"));
    }

    /** Resolves the caller and asserts they host {@code code}. */
    private User requireHostOf(UserPrincipal principal, String code) {
        User user = currentUser(principal);
        tournamentService.assertHost(code, user);
        return user;
    }

    @PostMapping
    public ResponseEntity<TournamentView> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateTournamentRequest request) {
        TournamentView view = tournamentService.create(currentUser(principal), request);
        return ResponseEntity.created(URI.create("/api/v1/host/tournaments/" + view.code())).body(view);
    }

    /** Every tournament the caller hosts, so the workspace can open its own. */
    @GetMapping
    public java.util.List<TournamentView> listMine(@AuthenticationPrincipal UserPrincipal principal) {
        return tournamentService.listHostedBy(currentUser(principal));
    }

    @GetMapping("/{code}")
    public TournamentView get(@AuthenticationPrincipal UserPrincipal principal, @PathVariable String code) {
        requireHostOf(principal, code);
        return tournamentService.get(code);
    }

    @PostMapping("/{code}/teams")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public TeamView registerTeam(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code,
            @Valid @RequestBody RegisterTeamRequest request) {
        requireHostOf(principal, code);
        return tournamentService.registerTeam(code, request);
    }

    @PostMapping("/{code}/teams/{teamId}/entry-fee")
    public TeamView markEntryFeePaid(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code, @PathVariable Long teamId) {
        requireHostOf(principal, code);
        return tournamentService.markEntryFeePaid(code, teamId);
    }

    @PostMapping("/{code}/multi-pitch-reserve")
    public TournamentView reserveSlots(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code,
            @Valid @RequestBody ReserveSlotsRequest request) {
        requireHostOf(principal, code);
        return tournamentService.reserveSlots(code, request);
    }

    /** Live price for repeating the reserved pattern weekly. Writes nothing. */
    @GetMapping("/{code}/reserve-quote")
    public ReservationQuote quote(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code,
            @RequestParam(defaultValue = "1") int repeatWeeks) {
        requireHostOf(principal, code);
        return tournamentService.quoteRecurring(code, repeatWeeks);
    }

    /** Confirms the bulk reservation and captures the server-priced deposit. */
    @PostMapping("/{code}/deposit")
    public TournamentView payDeposit(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code,
            @Valid @RequestBody PayDepositRequest request) {
        requireHostOf(principal, code);
        return tournamentService.payDeposit(code, request);
    }

    @PostMapping("/{code}/fixtures/generate")
    public List<FixtureView> generateFixtures(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code) {
        requireHostOf(principal, code);
        return tournamentService.generateFixtures(code);
    }

    /** Settles the remainder after the deposit, at the server-computed price. */
    @PostMapping("/{code}/balance")
    public TournamentView payBalance(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code,
            @Valid @RequestBody PayBalanceRequest request) {
        requireHostOf(principal, code);
        return tournamentService.payBalance(code, request);
    }

    /**
     * Updates host-editable settings: listing privacy and private event-day notes.
     */
    @PatchMapping("/{code}/settings")
    public TournamentView updateSettings(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code,
            @Valid @RequestBody UpdateTournamentSettingsRequest request) {
        requireHostOf(principal, code);
        return tournamentService.updateSettings(code, request);
    }

    /** Issues a new invite code; the previous link stops working immediately. */
    @PostMapping("/{code}/invite-code")
    public TournamentView regenerateInviteCode(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code) {
        requireHostOf(principal, code);
        return tournamentService.regenerateInviteCode(code);
    }

    @GetMapping("/{code}/fixtures")
    public List<FixtureView> listFixtures(@AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String code) {
        requireHostOf(principal, code);
        return tournamentService.listFixtures(code);
    }
}
