package com.turfchai.admin.config;

import com.turfchai.model.Admin;
import com.turfchai.model.User;
import com.turfchai.model.enums.AdminRole;
import com.turfchai.model.enums.AdminStatus;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.AdminRepository;
import com.turfchai.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;

/** Seeds the demo super admin (dev/test profiles only). */
@Configuration
@Profile({"dev", "test"})
public class AdminDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(AdminDataSeeder.class);

    public static final String SUPER_ADMIN_EMAIL = "fazle.rabbi.mugdho@gmail.com";

    @Bean
    @Order(0)   // before demo player/venue/tournament seeders
    CommandLineRunner seedSuperAdmin(UserRepository users, AdminRepository admins, PasswordEncoder passwordEncoder) {
        return args -> {
            User user = users.findByEmail(SUPER_ADMIN_EMAIL).orElseGet(() -> {
                User created = User.builder()
                        .fullName("Fazle Rabbi Mugdho")
                        .email(SUPER_ADMIN_EMAIL)
                        .phone("+8801700000001")
                        .passwordHash(passwordEncoder.encode("TurfChai@123"))
                        .role(RoleType.SUPER_ADMIN)
                        .status("ACTIVE")
                        .avatarInitials("FR")
                        .build();
                return users.save(created);
            });

            if (admins.findByUser_Id(user.getId()).isEmpty()) {
                admins.save(Admin.builder()
                        .user(user)
                        .adminRole(AdminRole.SUPER)
                        .permissions(Map.of("all", true))
                        .status(AdminStatus.ACTIVE)
                        .build());
                log.info("Seeded super admin {}", SUPER_ADMIN_EMAIL);
            }
        };
    }
}
