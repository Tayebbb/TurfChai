package com.turfchai.player.config;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.model.enums.SkillLevel;
import com.turfchai.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

/**
 * Seeds the demo player matching the frontend's `currentPlayer` persona (test
 * profile only).
 */
@Configuration
@Profile({ "dev", "test", "ci", "docker" })
public class PlayerDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(PlayerDataSeeder.class);

    /**
     * Public id of the seeded demo player. Lives here, in dev/test-only seeding
     * code, so that no production request path can ever resolve to it.
     */
    public static final UUID DEMO_PLAYER_PUBLIC_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    public static final String DEMO_PLAYER_EMAIL = "rafi@turfchai.com";
    public static final String DEMO_OWNER_EMAIL = "mahmud@turfchai.com";
    public static final String DEMO_PASSWORD = "TurfChai@123";

    @Bean
    @Order(1) // demo user first — venue and tournament seeders reference it
    CommandLineRunner seedDemoPlayer(UserRepository users, PasswordEncoder passwordEncoder) {
        return args -> {
            // 1. Seed / update demo player
            User player = users.findByEmail(DEMO_PLAYER_EMAIL).orElse(null);
            if (player == null) {
                player = users.save(User.builder()
                        .publicId(DEMO_PLAYER_PUBLIC_ID.toString())
                        .fullName("Rafiul Karim")
                        .email(DEMO_PLAYER_EMAIL)
                        .phone("+8801712000002")
                        .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                        .role(RoleType.PLAYER)
                        .status("ACTIVE")
                        .area("Dhanmondi, Dhaka")
                        .avatarInitials("RK")
                        .playStyle(SkillLevel.INTERMEDIATE)
                        .playerRole("captain")
                        .preferredSports("football,cricket")
                        .preferredTimes("evening,late night,weekends")
                        .build());
                log.info("Seeded demo player {}", player.getEmail());
            } else {
                player.setPasswordHash(passwordEncoder.encode(DEMO_PASSWORD));
                player.setStatus("ACTIVE");
                users.save(player);
            }

            // Also keep dev alias for backward compatibility with automated tests
            if (users.findByEmail("rafi@turfchai.dev").isEmpty()) {
                users.save(User.builder()
                        .publicId(UUID.randomUUID().toString())
                        .fullName("Rafiul Karim")
                        .email("rafi@turfchai.dev")
                        .phone("+8801712000678")
                        .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                        .role(RoleType.PLAYER)
                        .status("ACTIVE")
                        .avatarInitials("RK")
                        .build());
            }

            // 2. Seed / update demo owner
            User owner = users.findByEmail(DEMO_OWNER_EMAIL).orElse(null);
            if (owner == null) {
                owner = users.save(User.builder()
                        .publicId(UUID.randomUUID().toString())
                        .fullName("Mahmud Hasan")
                        .email(DEMO_OWNER_EMAIL)
                        .phone("+8801712000003")
                        .passwordHash(passwordEncoder.encode(DEMO_PASSWORD))
                        .role(RoleType.OWNER)
                        .status("ACTIVE")
                        .avatarInitials("MH")
                        .build());
                log.info("Seeded demo owner {}", owner.getEmail());
            } else {
                owner.setPasswordHash(passwordEncoder.encode(DEMO_PASSWORD));
                owner.setRole(RoleType.OWNER);
                owner.setStatus("ACTIVE");
                users.save(owner);
            }
        };
    }
}
