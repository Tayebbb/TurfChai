package com.turfchai.player.config;

import com.turfchai.player.api.UserProfileRestController;
import com.turfchai.player.entity.User;
import com.turfchai.player.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

/** Seeds the demo player matching the frontend's `currentPlayer` persona. */
@Configuration
public class PlayerDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(PlayerDataSeeder.class);

    @Bean
    @Order(2)   // after the venue seeder
    CommandLineRunner seedDemoPlayer(UserRepository users) {
        return args -> {
            if (users.findByPublicId(UserProfileRestController.DEMO_USER_ID).isPresent()) {
                return;
            }
            User user = new User();
            user.setPublicId(UserProfileRestController.DEMO_USER_ID);
            user.setFullName("Rafiul Karim");
            user.setEmail("rafi@turfchai.dev");
            user.setPhone("+8801712000678");
            user.setArea("Dhanmondi, Dhaka");
            user.setAvatarInitials("RK");
            user.setPlayStyle("intermediate");
            user.setPlayerRole("captain");
            user.setPreferredSports("football,cricket");
            user.setPreferredTimes("evening,late night,weekends");
            users.save(user);
            log.info("Seeded demo player {}", user.getEmail());
        };
    }
}
