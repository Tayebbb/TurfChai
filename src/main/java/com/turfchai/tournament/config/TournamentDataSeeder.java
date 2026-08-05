package com.turfchai.tournament.config;

import com.turfchai.player.entity.User;
import com.turfchai.player.repository.UserRepository;
import com.turfchai.tournament.api.TournamentRestController;
import com.turfchai.tournament.entity.Tournament;
import com.turfchai.tournament.entity.TournamentPitchReservation;
import com.turfchai.tournament.entity.TournamentTeam;
import com.turfchai.tournament.repository.TournamentPitchReservationRepository;
import com.turfchai.tournament.repository.TournamentRepository;
import com.turfchai.tournament.repository.TournamentTeamRepository;
import com.turfchai.tournament.service.TournamentService;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Seeds the "Ramadan Cup 2027" demo tournament matching the host-side
 * prototype: 4 pitches at Mirpur Sports City, 13 registered teams,
 * 13 reserved slots across the day, and a generated R16 bracket.
 */
@Configuration
public class TournamentDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(TournamentDataSeeder.class);

    /** Code the frontend prototype hardcodes. */
    public static final String DEMO_CODE = "TR-CUP-0091";

    @Bean
    @Order(3)   // after venue (1) and player (2) seeders
    CommandLineRunner seedDemoTournament(TournamentRepository tournaments,
                                         TournamentTeamRepository teams,
                                         TournamentPitchReservationRepository reservations,
                                         VenueRepository venues,
                                         PitchRepository pitches,
                                         UserRepository users,
                                         TournamentService tournamentService,
                                         org.springframework.transaction.support.TransactionTemplate tx) {
        return args -> {
            if (tournaments.existsByCode(DEMO_CODE)) {
                return;
            }
            tx.executeWithoutResult(status ->
                    seed(tournaments, teams, reservations, venues, pitches, users));
            // seed() skips quietly when demo prerequisites are missing — only
            // generate the bracket if the tournament actually exists.
            if (tournaments.existsByCode(DEMO_CODE)) {
                tournamentService.generateFixtures(DEMO_CODE);
                log.info("Seeded demo tournament {}", DEMO_CODE);
            }
        };
    }

    void seed(TournamentRepository tournaments,
              TournamentTeamRepository teams,
              TournamentPitchReservationRepository reservations,
              VenueRepository venues,
              PitchRepository pitches,
              UserRepository users) {
        Venue venue = venues.findBySlug("mirpur-sports-city").orElse(null);
        User host = users.findByPublicId(TournamentRestController.DEMO_USER_ID).orElse(null);
        if (venue == null || host == null) {
            log.warn("Skipping tournament seed — demo venue or user missing");
            return;
        }

        // The prototype's multi-pitch grid: Pitch A-C are 7-a-side, D is 9-a-side.
        List<Pitch> tournamentPitches = new ArrayList<>();
        String[][] specs = {{"Pitch A", "7_a_side"}, {"Pitch B", "7_a_side"},
                {"Pitch C", "7_a_side"}, {"Pitch D", "9_a_side"}};
        for (String[] spec : specs) {
            Pitch p = new Pitch();
            p.setVenue(venue);
            p.setName(spec[0]);
            p.setFormat(spec[1]);
            p.setSurfaceType("Artificial grass");
            p.setLighting("LED floodlights");
            p.setMaxPlayers("9_a_side".equals(spec[1]) ? 18 : 14);
            tournamentPitches.add(pitches.save(p));
        }

        Tournament t = new Tournament();
        t.setCode(DEMO_CODE);
        t.setName("Ramadan Cup 2027");
        t.setHost(host);
        t.setVenue(venue);
        t.setTournamentDate(LocalDate.of(2027, 8, 21));
        t.setWindowStart(LocalTime.of(8, 0));
        t.setWindowEnd(LocalTime.of(18, 0));
        t.setFormat("knockout");
        t.setTeamCapacity(16);
        t.setEntryFeePerTeam(new BigDecimal("3500"));
        t.setPrizePool(new BigDecimal("40000"));
        t.setPrivacy("invite_only");
        t.setInviteCode("t/ramadan-cup-0091");
        t.setStatus("confirmed");
        t.setBalanceDueDate(LocalDate.of(2027, 8, 18));
        t = tournaments.save(t);

        String[] teamNames = {"Dhanmondi Strikers", "Mirpur Kings", "Uttara FC", "Banani Blues",
                "Gulshan Gladiators", "Bashundhara Boys", "Mohammadpur Mavericks", "Lalmatia Lions",
                "Badda Blasters", "Khilgaon Knights", "Motijheel Marauders", "Tejgaon Titans",
                "Wari Warriors"};
        for (String name : teamNames) {
            TournamentTeam team = new TournamentTeam();
            team.setTournament(t);
            team.setName(name);
            team.setCaptainName(name.split(" ")[0] + " Captain");
            team.setEntryFeeStatus("paid");
            team.setEntryFeePaid(t.getEntryFeePerTeam());
            teams.save(team);
        }

        // Reserved slots (mirrors the prototype grid; C@10:00 and B@14:00 are
        // taken by other bookings, so they are deliberately not reserved).
        int[][] slotMatrix = {
                // hour, pitchA..D reserved?
                {8, 1, 1, 0, 1},
                {10, 1, 1, 0, 1},
                {12, 1, 1, 0, 1},
                {14, 1, 0, 0, 1},
                {16, 1, 0, 0, 1},
        };
        BigDecimal[] pitchRate = {new BigDecimal("3000"), new BigDecimal("3000"),
                new BigDecimal("3000"), new BigDecimal("3600")};
        for (int[] row : slotMatrix) {
            for (int p = 0; p < 4; p++) {
                if (row[p + 1] == 0) {
                    continue;
                }
                TournamentPitchReservation r = new TournamentPitchReservation();
                r.setTournament(t);
                r.setPitch(tournamentPitches.get(p));
                r.setSlotDate(t.getTournamentDate());
                r.setStartTime(LocalTime.of(row[0], 0));
                r.setEndTime(LocalTime.of(row[0] + 2, 0));
                r.setPrice(pitchRate[p]);
                reservations.save(r);
            }
        }
    }
}
