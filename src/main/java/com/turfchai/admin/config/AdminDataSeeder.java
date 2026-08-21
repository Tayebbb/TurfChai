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
@Profile({"dev", "test", "ci", "docker"})
public class AdminDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(AdminDataSeeder.class);

    public static final String SUPER_ADMIN_EMAIL = "shahadat.cse.20230104008@aust.edu";
    public static final String SUPER_ADMIN_NAME = "Shahadat Hossain";
    public static final String SUPER_ADMIN_PHONE = "+8801700000008";

    public static final String SECONDARY_ADMIN_EMAIL = "fazle.rabbi.mugdho@gmail.com";
    public static final String SECONDARY_ADMIN_NAME = "Fazle Rabbi Mugdho";
    public static final String SECONDARY_ADMIN_PHONE = "+8801700000001";

    public static final String SUPER_ADMIN_PASSWORD = "TurfChai@123";

    @Bean
    @Order(0)   // before demo player/venue/tournament seeders
    CommandLineRunner seedSuperAdmin(UserRepository users, AdminRepository admins, PasswordEncoder passwordEncoder) {
        return args -> {
            seedAdminAccount(users, admins, passwordEncoder, SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PHONE, AdminRole.SUPER);
            seedAdminAccount(users, admins, passwordEncoder, SECONDARY_ADMIN_NAME, SECONDARY_ADMIN_EMAIL, SECONDARY_ADMIN_PHONE, AdminRole.VERIFICATION);
            seedAdminAccount(users, admins, passwordEncoder, "Nadia Amin", "nadia@turfchai.com", "+8801712000001", AdminRole.VERIFICATION);
        };
    }

    private void seedAdminAccount(UserRepository users, AdminRepository admins, PasswordEncoder passwordEncoder,
                                  String name, String email, String phone, AdminRole adminRole) {
        // Enforce single super admin constraint: demote other super admins before setting new super admin
        if (adminRole == AdminRole.SUPER) {
            users.findAll().stream()
                    .filter(u -> u.getRole() == RoleType.SUPER_ADMIN && !email.equalsIgnoreCase(u.getEmail()))
                    .forEach(u -> {
                        u.setRole(RoleType.ADMIN);
                        users.save(u);
                    });
        }

        User user = users.findByEmail(email).orElse(null);
        String initials = name.split(" ").length > 1
                ? ("" + name.split(" ")[0].charAt(0) + name.split(" ")[1].charAt(0)).toUpperCase()
                : "AD";

        var phoneHolder = users.findByPhone(phone).orElse(null);
        if (phoneHolder != null && (user == null || !phoneHolder.getId().equals(user.getId()))) {
            phoneHolder.setPhone("+88017" + String.format("%08d", Math.abs(phoneHolder.getEmail().hashCode() % 90000000 + 10000000)));
            users.save(phoneHolder);
        }

        if (user == null) {
            user = users.save(User.builder()
                    .fullName(name)
                    .email(email)
                    .phone(phone)
                    .passwordHash(passwordEncoder.encode(SUPER_ADMIN_PASSWORD))
                    .role(adminRole == AdminRole.SUPER ? RoleType.SUPER_ADMIN : RoleType.ADMIN)
                    .status("ACTIVE")
                    .avatarInitials(initials)
                    .build());
            log.info("Created admin {}", email);
        } else {
            user.setPasswordHash(passwordEncoder.encode(SUPER_ADMIN_PASSWORD));
            user.setRole(adminRole == AdminRole.SUPER ? RoleType.SUPER_ADMIN : RoleType.ADMIN);
            user.setStatus("ACTIVE");
            users.save(user);
            log.info("Updated admin credentials for {}", email);
        }

        if (admins.findByUser_Id(user.getId()).isEmpty()) {
            admins.save(Admin.builder()
                    .user(user)
                    .adminRole(adminRole)
                    .permissions(Map.of("perm_review", true, "perm_listings", true, "perm_users", true, "perm_reports", true, "all", true))
                    .status(AdminStatus.ACTIVE)
                    .build());
            log.info("Seeded admin record for {}", email);
        }
    }
}
