package com.turfchai.tournament.api;

import com.turfchai.player.entity.User;
import com.turfchai.player.repository.UserRepository;
import com.turfchai.tournament.service.TournamentRequests.CreateTournamentRequest;
import com.turfchai.tournament.service.TournamentRequests.RegisterTeamRequest;
import com.turfchai.tournament.service.TournamentRequests.ReserveSlotsRequest;
import com.turfchai.tournament.service.TournamentService;
import com.turfchai.tournament.service.TournamentViews.FixtureView;
import com.turfchai.tournament.service.TournamentViews.TeamView;
import com.turfchai.tournament.service.TournamentViews.TournamentView;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * Host tournament hub.
 *
 * <p>TEMPORARY IDENTITY: the host is selected via the {@code X-User-Id}
 * header (public UUID), falling back to the seeded demo user — same interim
 * pattern as the player API, swapped for the JWT principal when the
 * authentication task (owned by another developer) lands.
 */
@RestController
@RequestMapping("/api/v1/host/tournaments")
public class TournamentRestController {

    /** Public id of the seeded demo user (see PlayerDataSeeder). */
    public static final UUID DEMO_USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    private final TournamentService tournamentService;
    private final UserRepository users;

    public TournamentRestController(TournamentService tournamentService, UserRepository users) {
        this.tournamentService = tournamentService;
        this.users = users;
    }

    private User currentUser(String header) {
        UUID id;
        if (header == null || header.isBlank()) {
            id = DEMO_USER_ID;
        } else {
            try {
                id = UUID.fromString(header.trim());
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("X-User-Id must be a UUID");
            }
        }
        return users.findByPublicId(id)
                .orElseThrow(() -> new IllegalArgumentException("Unknown user: " + id));
    }

    @PostMapping
    public ResponseEntity<TournamentView> create(
            @RequestHeader(value = "X-User-Id", required = false) String userHeader,
            @Valid @RequestBody CreateTournamentRequest request) {
        TournamentView view = tournamentService.create(currentUser(userHeader), request);
        return ResponseEntity.created(URI.create("/api/v1/host/tournaments/" + view.code())).body(view);
    }

    @GetMapping("/{code}")
    public TournamentView get(@PathVariable String code) {
        return tournamentService.get(code);
    }

    @PostMapping("/{code}/teams")
    @org.springframework.web.bind.annotation.ResponseStatus(HttpStatus.CREATED)
    public TeamView registerTeam(@PathVariable String code,
                                 @Valid @RequestBody RegisterTeamRequest request) {
        return tournamentService.registerTeam(code, request);
    }

    @PostMapping("/{code}/teams/{teamId}/entry-fee")
    public TeamView markEntryFeePaid(@PathVariable String code, @PathVariable Long teamId) {
        return tournamentService.markEntryFeePaid(code, teamId);
    }

    @PostMapping("/{code}/multi-pitch-reserve")
    public TournamentView reserveSlots(@PathVariable String code,
                                       @Valid @RequestBody ReserveSlotsRequest request) {
        return tournamentService.reserveSlots(code, request);
    }

    @PostMapping("/{code}/fixtures/generate")
    public List<FixtureView> generateFixtures(@PathVariable String code) {
        return tournamentService.generateFixtures(code);
    }

    @GetMapping("/{code}/fixtures")
    public List<FixtureView> listFixtures(@PathVariable String code) {
        return tournamentService.listFixtures(code);
    }
}
