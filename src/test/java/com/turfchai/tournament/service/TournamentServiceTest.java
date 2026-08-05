package com.turfchai.tournament.service;

import com.turfchai.player.api.UserProfileRestController;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.tournament.config.TournamentDataSeeder;
import com.turfchai.tournament.repository.TournamentFixtureRepository;
import com.turfchai.tournament.repository.TournamentPitchReservationRepository;
import com.turfchai.tournament.repository.TournamentRepository;
import com.turfchai.tournament.repository.TournamentTeamRepository;
import com.turfchai.tournament.service.TournamentRequests.CreateTournamentRequest;
import com.turfchai.tournament.service.TournamentRequests.RegisterTeamRequest;
import com.turfchai.tournament.service.TournamentRequests.ReserveSlotsRequest;
import com.turfchai.tournament.service.TournamentRequests.SlotRequest;
import com.turfchai.tournament.service.TournamentService.PitchConflictException;
import com.turfchai.tournament.service.TournamentService.TournamentConflictException;
import com.turfchai.tournament.service.TournamentService.TournamentNotFoundException;
import com.turfchai.tournament.service.TournamentViews.FixtureView;
import com.turfchai.tournament.service.TournamentViews.TeamView;
import com.turfchai.tournament.service.TournamentViews.TournamentView;
import com.turfchai.venue.repository.PitchRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@org.springframework.test.context.ActiveProfiles({"test", "dev"})
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:tournament-svc-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class TournamentServiceTest {

    @Autowired
    private TournamentService service;
    @Autowired
    private TournamentRepository tournaments;
    @Autowired
    private TournamentTeamRepository teams;
    @Autowired
    private TournamentFixtureRepository fixtures;
    @Autowired
    private TournamentPitchReservationRepository reservations;
    @Autowired
    private UserRepository users;
    @Autowired
    private PitchRepository pitches;

    @org.junit.jupiter.api.BeforeEach
    void cleanUpNonSeededTournaments() {
        tournaments.findAll().stream()
                .filter(t -> !TournamentDataSeeder.DEMO_CODE.equals(t.getCode()))
                .forEach(tournaments::delete);
    }

    private User demoHost() {
        return users.findByPublicId(UserProfileRestController.DEMO_USER_ID.toString()).orElseThrow();
    }

    private TournamentView createTournament(int capacity) {
        return service.create(demoHost(), new CreateTournamentRequest(
                "Test Cup", "kick-off-arena", LocalDate.of(2027, 9, 4),
                LocalTime.of(8, 0), LocalTime.of(18, 0), "knockout",
                capacity, new BigDecimal("2000"), BigDecimal.ZERO, "open"));
    }

    private Long pitchIdOf(String venueSlug) {
        return pitches.findByVenueSlug(venueSlug).stream()
                .findFirst().orElseThrow().getId();
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    @Test
    void createAssignsCodeAndInviteLink() {
        TournamentView t = createTournament(8);
        assertThat(t.code()).matches("TR-CUP-\\d{4}");
        assertThat(t.inviteCode()).startsWith("t/test-cup-");
        assertThat(t.status()).isEqualTo("PUBLISHED");
        assertThat(t.balanceDueDate()).isEqualTo(LocalDate.of(2027, 9, 1));
    }

    @Test
    void unknownTournamentRaisesNotFound() {
        assertThatThrownBy(() -> service.get("TR-CUP-XXXX"))
                .isInstanceOf(TournamentNotFoundException.class);
    }

    @Test
    void seededRamadanCupIsComplete() {
        TournamentView t = service.get(TournamentDataSeeder.DEMO_CODE);
        assertThat(t.name()).isEqualTo("Ramadan Cup 2027");
        assertThat(t.teams()).hasSize(13);
        assertThat(t.reservations()).hasSize(13);
        assertThat(t.fixtures()).isNotEmpty();
        assertThat(t.costs().slotCount()).isEqualTo(13);
        // 13 slots >= 12 -> bundle discount applies and deposit is 40% of total
        assertThat(t.costs().discount()).isGreaterThan(BigDecimal.ZERO);
        assertThat(t.costs().deposit().add(t.costs().balance()))
                .isEqualByComparingTo(t.costs().total());
    }

    // ------------------------------------------------------------------
    // Team registration + entry fees
    // ------------------------------------------------------------------

    @Test
    void registerTeamEnforcesCapacityAndDuplicateNames() {
        TournamentView t = createTournament(2);
        service.registerTeam(t.code(), new RegisterTeamRequest("Alpha", "A"));

        assertThatThrownBy(() -> service.registerTeam(t.code(), new RegisterTeamRequest("ALPHA", "B")))
                .isInstanceOf(TournamentConflictException.class)
                .hasMessageContaining("already registered");

        service.registerTeam(t.code(), new RegisterTeamRequest("Beta", "B"));
        assertThatThrownBy(() -> service.registerTeam(t.code(), new RegisterTeamRequest("Gamma", "C")))
                .isInstanceOf(TournamentConflictException.class)
                .hasMessageContaining("full");
    }

    @Test
    void markEntryFeePaidTracksAmount() {
        TournamentView t = createTournament(4);
        TeamView team = service.registerTeam(t.code(), new RegisterTeamRequest("Alpha", "A"));
        TeamView paid = service.markEntryFeePaid(t.code(), team.id());
        assertThat(paid.entryFeeStatus()).isEqualTo("PAID");
        assertThat(paid.entryFeePaid()).isEqualByComparingTo("2000");
    }

    // ------------------------------------------------------------------
    // Multi-pitch reservations + conflict avoidance
    // ------------------------------------------------------------------

    @Test
    void reserveSlotsRejectsOverlapWithExistingReservation() {
        TournamentView t = createTournament(8);
        Long pitchId = pitchIdOf("kick-off-arena");
        service.reserveSlots(t.code(), new ReserveSlotsRequest(List.of(
                new SlotRequest(pitchId, LocalTime.of(8, 0), LocalTime.of(10, 0)))));

        // Overlapping window (9-11) on the same pitch/date must 409.
        assertThatThrownBy(() -> service.reserveSlots(t.code(), new ReserveSlotsRequest(List.of(
                new SlotRequest(pitchId, LocalTime.of(9, 0), LocalTime.of(11, 0))))))
                .isInstanceOf(PitchConflictException.class);

        // Adjacent window (10-12) is fine.
        TournamentView after = service.reserveSlots(t.code(), new ReserveSlotsRequest(List.of(
                new SlotRequest(pitchId, LocalTime.of(10, 0), LocalTime.of(12, 0)))));
        assertThat(after.reservations()).hasSize(2);
        // Prices are computed server-side from the venue's pricing rules.
        assertThat(after.reservations()).allSatisfy(r ->
                assertThat(r.price()).isGreaterThan(BigDecimal.ZERO));
    }

    @Test
    void reserveSlotsRejectsInRequestOverlapAndForeignPitch() {
        TournamentView t = createTournament(8);
        Long pitchId = pitchIdOf("kick-off-arena");
        assertThatThrownBy(() -> service.reserveSlots(t.code(), new ReserveSlotsRequest(List.of(
                new SlotRequest(pitchId, LocalTime.of(8, 0), LocalTime.of(10, 0)),
                new SlotRequest(pitchId, LocalTime.of(9, 0), LocalTime.of(11, 0))))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("overlapping");

        Long foreignPitch = pitchIdOf("baridhara-sports-hub");
        assertThatThrownBy(() -> service.reserveSlots(t.code(), new ReserveSlotsRequest(List.of(
                new SlotRequest(foreignPitch, LocalTime.of(8, 0), LocalTime.of(10, 0))))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not belong");

        // Slots outside the tournament window are rejected.
        assertThatThrownBy(() -> service.reserveSlots(t.code(), new ReserveSlotsRequest(List.of(
                new SlotRequest(pitchId, LocalTime.of(20, 0), LocalTime.of(22, 0))))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("outside the tournament window");
    }

    @Test
    void twoTournamentsCannotReserveTheSamePitchSlotOnTheSameDate() {
        TournamentView a = createTournament(8);
        TournamentView b = createTournament(8);
        Long pitchId = pitchIdOf("kick-off-arena");
        SlotRequest slot = new SlotRequest(pitchId, LocalTime.of(14, 0), LocalTime.of(16, 0));
        service.reserveSlots(a.code(), new ReserveSlotsRequest(List.of(slot)));
        assertThatThrownBy(() -> service.reserveSlots(b.code(), new ReserveSlotsRequest(List.of(slot))))
                .isInstanceOf(PitchConflictException.class);
    }

    // ------------------------------------------------------------------
    // Fixture bracket generation
    // ------------------------------------------------------------------

    private TournamentView tournamentWithPaidTeams(int paidTeams, int slots) {
        TournamentView t = createTournament(16);
        for (int i = 0; i < paidTeams; i++) {
            TeamView team = service.registerTeam(t.code(), new RegisterTeamRequest("Team " + (char) ('A' + i), null));
            service.markEntryFeePaid(t.code(), team.id());
        }
        Long pitchId = pitchIdOf("kick-off-arena");
        for (int i = 0; i < slots; i++) {
            service.reserveSlots(t.code(), new ReserveSlotsRequest(List.of(new SlotRequest(
                    pitchId, LocalTime.of(8 + i, 0), LocalTime.of(9 + i, 0)))));
        }
        return service.get(t.code());
    }

    @Test
    void bracketForPowerOfTwoTeamsHasNoByes() {
        TournamentView t = tournamentWithPaidTeams(4, 2);
        List<FixtureView> generated = service.generateFixtures(t.code());
        assertThat(generated).hasSize(2);
        assertThat(generated).allMatch(f -> "SF".equals(f.roundLabel()));
        assertThat(generated).allMatch(f -> "SCHEDULED".equals(f.status()));
        assertThat(generated).allMatch(f -> f.pitchName() != null && f.startTime() != null);
        // No pitch/time collision between fixtures.
        assertThat(generated.stream().map(f -> f.pitchName() + "@" + f.startTime()).distinct())
                .hasSize(2);
    }

    @Test
    void bracketWithNonPowerOfTwoAssignsByesToEarliestTeams() {
        // 5 paid teams -> bracket of 8 -> 3 byes + 1 real match
        TournamentView t = tournamentWithPaidTeams(5, 1);
        List<FixtureView> generated = service.generateFixtures(t.code());
        assertThat(generated).hasSize(4);
        assertThat(generated.stream().filter(f -> "BYE".equals(f.status()))).hasSize(3);
        FixtureView real = generated.stream().filter(f -> "SCHEDULED".equals(f.status())).findFirst().orElseThrow();
        assertThat(real.roundLabel()).isEqualTo("QF");
        assertThat(real.teamA()).isEqualTo("Team D");
        assertThat(real.teamB()).isEqualTo("Team E");
    }

    @Test
    void bracketRequiresPaidTeamsAndEnoughSlots() {
        TournamentView none = createTournament(8);
        assertThatThrownBy(() -> service.generateFixtures(none.code()))
                .isInstanceOf(TournamentConflictException.class)
                .hasMessageContaining("paid");

        // 4 paid teams need 2 slots but only 1 reserved.
        TournamentView starved = tournamentWithPaidTeams(4, 1);
        assertThatThrownBy(() -> service.generateFixtures(starved.code()))
                .isInstanceOf(TournamentConflictException.class)
                .hasMessageContaining("Not enough reserved slots");
    }

    @Test
    void regeneratingFixturesReplacesThePreviousBracket() {
        TournamentView t = tournamentWithPaidTeams(4, 3);
        service.generateFixtures(t.code());
        TeamView late = service.registerTeam(t.code(), new RegisterTeamRequest("Latecomers", null));
        service.markEntryFeePaid(t.code(), late.id());
        List<FixtureView> regenerated = service.generateFixtures(t.code());
        // 5 paid -> bracket 8 -> 4 fixtures total (3 byes + 1 match)
        assertThat(regenerated).hasSize(4);
        assertThat(service.listFixtures(t.code())).hasSize(4);
    }

    @Test
    void bracketSeedsOnlyPaidTeamsWhenFieldIsMixed() {
        TournamentView t = tournamentWithPaidTeams(4, 3);
        // Two extra teams that never pay must not appear in the bracket.
        service.registerTeam(t.code(), new RegisterTeamRequest("Unpaid One", null));
        service.registerTeam(t.code(), new RegisterTeamRequest("Unpaid Two", null));
        List<FixtureView> generated = service.generateFixtures(t.code());
        assertThat(generated).hasSize(2);
        assertThat(generated)
                .noneMatch(f -> "Unpaid One".equals(f.teamA()) || "Unpaid One".equals(f.teamB())
                        || "Unpaid Two".equals(f.teamA()) || "Unpaid Two".equals(f.teamB()));
    }

    @Test
    void roundLabelsFollowBracketSize() {
        assertThat(TournamentService.roundLabel(2)).isEqualTo("Final");
        assertThat(TournamentService.roundLabel(4)).isEqualTo("SF");
        assertThat(TournamentService.roundLabel(8)).isEqualTo("QF");
        assertThat(TournamentService.roundLabel(16)).isEqualTo("R16");
        assertThat(TournamentService.roundLabel(32)).isEqualTo("R32");
    }
}
