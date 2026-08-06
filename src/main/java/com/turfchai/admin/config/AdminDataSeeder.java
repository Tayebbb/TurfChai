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

/** Seeds the demo super admin (dev/test/ci profiles only — never prod).
 *  If a SUPER_ADMIN already exists (from V4 migration), updates it to the
 *  desired credentials rather than failing the unique index constraint. */
@Configuration
@Profile({"dev", "test", "ci"})
public class AdminDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(AdminDataSeeder.class);

    public static final String SUPER_ADMIN_EMAIL = "fazle.rabbi.mugdho@gmail.com";
    public static final String SUPER_ADMIN_NAME = "Fazle Rabbi Mugdho";
    public static final String SUPER_ADMIN_PHONE = "+8801700000001";
    public static final String SUPER_ADMIN_PASSWORD = "TurfChai@123";

    @Bean
    @Order(0)   // before demo player/venue/tournament seeders
    CommandLineRunner seedSuperAdmin(UserRepository users, AdminRepository admins, PasswordEncoder passwordEncoder) {
        return args -> {
            User user = users.findAll().stream()
                    .filter(u -> u.getRole() == RoleType.SUPER_ADMIN)
                    .findFirst().orElse(null);

            if (user == null) {
                user = users.save(User.builder()
                        .fullName(SUPER_ADMIN_NAME)
                        .email(SUPER_ADMIN_EMAIL)
                        .phone(SUPER_ADMIN_PHONE)
                        .passwordHash(passwordEncoder.encode(SUPER_ADMIN_PASSWORD))
                        .role(RoleType.SUPER_ADMIN)
                        .status("ACTIVE")
                        .avatarInitials("FR")
                        .build());
                log.info("Created super admin {}", SUPER_ADMIN_EMAIL);
            } else {
                user.setEmail(SUPER_ADMIN_EMAIL);
                user.setFullName(SUPER_ADMIN_NAME);
                user.setPhone(SUPER_ADMIN_PHONE);
                user.setPasswordHash(passwordEncoder.encode(SUPER_ADMIN_PASSWORD));
                user.setAvatarInitials("FR");
                users.save(user);
                log.info("Updated existing super admin to {}", SUPER_ADMIN_EMAIL);
            }

            if (admins.findByUser_Id(user.getId()).isEmpty()) {
                admins.save(Admin.builder()
                        .user(user)
                        .adminRole(AdminRole.SUPER)
                        .permissions(Map.of("all", true))
                        .status(AdminStatus.ACTIVE)
                        .build());
                log.info("Seeded admin record for super admin");
            }
        };
    }
}
