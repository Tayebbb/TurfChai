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

/** Seeds the demo player matching the frontend's `currentPlayer` persona (test profile only). */
@Configuration
@Profile({"dev", "test"})
public class PlayerDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(PlayerDataSeeder.class);

    /**
     * Public id of the seeded demo player. Lives here, in dev/test-only seeding
     * code, so that no production request path can ever resolve to it.
     */
    public static final UUID DEMO_PLAYER_PUBLIC_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    @Bean
    @Order(1)   // demo user first — venue and tournament seeders reference it
    CommandLineRunner seedDemoPlayer(UserRepository users, PasswordEncoder passwordEncoder) {
        return args -> {
            if (users.findByPublicId(DEMO_PLAYER_PUBLIC_ID.toString()).isPresent()) {
                return;
            }
            User user = User.builder()
                    .publicId(DEMO_PLAYER_PUBLIC_ID.toString())
                    .fullName("Rafiul Karim")
                    .email("rafi@turfchai.dev")
                    .phone("+8801712000678")
                    .passwordHash(passwordEncoder.encode("demo1234"))
                    .role(RoleType.PLAYER)
                    .area("Dhanmondi, Dhaka")
                    .avatarInitials("RK")
                    .playStyle(SkillLevel.INTERMEDIATE)
                    .playerRole("captain")
                    .preferredSports("football,cricket")
                    .preferredTimes("evening,late night,weekends")
                    .build();
            users.save(user);
            log.info("Seeded demo player {}", user.getEmail());
        };
    }
}
