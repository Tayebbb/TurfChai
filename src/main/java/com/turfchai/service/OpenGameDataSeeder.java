package com.turfchai.service;

import com.turfchai.model.OpenGame;
import com.turfchai.model.OpenGameMembership;
import com.turfchai.model.User;
import com.turfchai.model.enums.GameMembershipStatus;
import com.turfchai.model.enums.OpenGameStatus;
import com.turfchai.model.enums.RoleType;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.OpenGameMembershipRepository;
import com.turfchai.repository.OpenGameRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Seeds realistic Open Games and joined player memberships on startup.
 * Triggers when the {@code open_games} table is empty.
 */
@Slf4j
@Component
@Profile({ "dev", "test", "ci", "docker" })
@Order(12) // After AdminPartBDataSeeder and basic seeders
@RequiredArgsConstructor
public class OpenGameDataSeeder implements CommandLineRunner {

    private final OpenGameRepository openGameRepository;
    private final OpenGameMembershipRepository membershipRepository;
    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional
    public void run(String... args) {
        seed();
    }

    @Transactional
    public void seed() {
        if (openGameRepository.count() > 0) {
            log.info("[OpenGameSeeder] Open games already seeded ({} games) — skipping.", openGameRepository.count());
            return;
        }

        List<Venue> venues = venueRepository.findAll();
        List<User> players = userRepository.findAll().stream()
                .filter(u -> u.getRole() == RoleType.PLAYER || u.getRole() == RoleType.SOLO_PLAYER)
                .toList();

        if (venues.isEmpty() || players.isEmpty()) {
            log.warn("[OpenGameSeeder] Cannot seed open games: venues or players missing.");
            return;
        }

        log.info("[OpenGameSeeder] Seeding realistic open games...");

        LocalDate today = LocalDate.now();

        record GameSpec(
                String title,
                String venueSlug,
                int dayOffset,
                LocalTime start,
                LocalTime end,
                SkillLevel skill,
                int capacity,
                int initialMembers,
                BigDecimal price,
                int minReliability
        ) {}

        List<GameSpec> specs = List.of(
                new GameSpec("Friday Night 7v7 Clash", "kick-off-arena", 0, LocalTime.of(19, 0), LocalTime.of(20, 30), SkillLevel.INTERMEDIATE, 14, 11, new BigDecimal("250.00"), 80),
                new GameSpec("Casual 6-a-side Football", "greenturf-mohammadpur", 0, LocalTime.of(20, 30), LocalTime.of(22, 0), SkillLevel.BEGINNER, 12, 6, new BigDecimal("180.00"), 70),
                new GameSpec("Morning Futsal Friendly", "banani-futsal-hub", 1, LocalTime.of(8, 0), LocalTime.of(9, 30), SkillLevel.ALL_LEVELS, 10, 8, new BigDecimal("200.00"), 75),
                new GameSpec("Weekend Premier 11v11", "mirpur-sports-city", 1, LocalTime.of(17, 0), LocalTime.of(19, 0), SkillLevel.ADVANCED, 22, 16, new BigDecimal("300.00"), 85),
                new GameSpec("Evening 7-a-side Scrimmage", "gulshan-turf-park", 2, LocalTime.of(18, 30), LocalTime.of(20, 0), SkillLevel.INTERMEDIATE, 14, 7, new BigDecimal("280.00"), 80),
                new GameSpec("Night Owl 5v5 Futsal", "bashundhara-arena", 2, LocalTime.of(21, 0), LocalTime.of(22, 30), SkillLevel.ALL_LEVELS, 10, 5, new BigDecimal("220.00"), 70),
                new GameSpec("Uttara Community Match", "uttara-sports-complex", 3, LocalTime.of(16, 30), LocalTime.of(18, 0), SkillLevel.ALL_LEVELS, 14, 9, new BigDecimal("200.00"), 75),
                new GameSpec("Midweek Competitive 7v7", "kick-off-arena", 4, LocalTime.of(19, 30), LocalTime.of(21, 0), SkillLevel.ADVANCED, 14, 12, new BigDecimal("260.00"), 85)
        );

        int codeSeq = 100;
        int playerIdx = 0;

        for (GameSpec spec : specs) {
            Venue venue = venues.stream()
                    .filter(v -> v.getSlug() != null && v.getSlug().contains(spec.venueSlug()))
                    .findFirst()
                    .orElse(venues.get(codeSeq % venues.size()));

            Pitch pitch = venue.getPitches() != null && !venue.getPitches().isEmpty()
                    ? venue.getPitches().get(0)
                    : null;

            User organizer = players.get(playerIdx % players.size());
            playerIdx++;

            int targetMembers = Math.min(spec.initialMembers(), spec.capacity());
            OpenGameStatus status = OpenGameStatus.OPEN;
            if (targetMembers >= spec.capacity()) {
                status = OpenGameStatus.FULL;
            } else if (targetMembers >= spec.capacity() - 2) {
                status = OpenGameStatus.ALMOST_FULL;
            }

            String gameCode = "OG-" + String.format("%04d", ++codeSeq);

            OpenGame game = OpenGame.builder()
                    .gameCode(gameCode)
                    .title(spec.title())
                    .venue(venue)
                    .pitch(pitch)
                    .gameDate(today.plusDays(spec.dayOffset()))
                    .startTime(spec.start())
                    .endTime(spec.end())
                    .skillLevel(spec.skill())
                    .capacity(spec.capacity())
                    .filledCount(targetMembers)
                    .pricePerPlayer(spec.price())
                    .organizer(organizer)
                    .status(status)
                    .minimumReliability(spec.minReliability())
                    .createdAt(OffsetDateTime.now().minusDays(1))
                    .updatedAt(OffsetDateTime.now())
                    .build();

            OpenGame savedGame = openGameRepository.save(game);

            // Add memberships
            List<OpenGameMembership> memberships = new ArrayList<>();
            // Organizer is always a joined member
            memberships.add(OpenGameMembership.builder()
                    .openGame(savedGame)
                    .user(organizer)
                    .status(GameMembershipStatus.JOINED)
                    .showUp(true)
                    .joinedAt(savedGame.getCreatedAt())
                    .createdAt(savedGame.getCreatedAt())
                    .updatedAt(savedGame.getCreatedAt())
                    .build());

            for (int m = 1; m < targetMembers; m++) {
                User memberUser = players.get((playerIdx++) % players.size());
                // Avoid duplicates
                if (memberships.stream().anyMatch(mem -> mem.getUser().getId().equals(memberUser.getId()))) {
                    continue;
                }
                memberships.add(OpenGameMembership.builder()
                        .openGame(savedGame)
                        .user(memberUser)
                        .status(GameMembershipStatus.JOINED)
                        .showUp(true)
                        .joinedAt(savedGame.getCreatedAt().plusMinutes(m * 10L))
                        .createdAt(savedGame.getCreatedAt().plusMinutes(m * 10L))
                        .updatedAt(savedGame.getCreatedAt().plusMinutes(m * 10L))
                        .build());
            }

            membershipRepository.saveAll(memberships);
        }

        log.info("[OpenGameSeeder] Successfully seeded {} open games with memberships.", specs.size());
    }
}
