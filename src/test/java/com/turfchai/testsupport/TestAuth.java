package com.turfchai.testsupport;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

/**
 * Test helper for authenticating requests the way a real client does: a signed
 * JWT in the {@code Authorization} header, verified by the real filter chain.
 *
 * <p>Deliberately not a mocked principal — these are security tests, so the
 * token has to travel through {@code JwtAuthenticationFilter} and
 * {@code SecurityConfig} exactly as it would in production.
 */
public final class TestAuth {

    public static final String PASSWORD = "TestPass@123";

    private TestAuth() {
    }

    /** {@code Authorization} header value for an existing user. */
    public static String bearer(JwtService jwtService, User user) {
        return "Bearer " + jwtService.generateToken(user);
    }

    /** Creates (or reuses) a user with the given email and role. */
    public static User user(UserRepository users, PasswordEncoder encoder,
                            String email, RoleType role) {
        return users.findByEmail(email).orElseGet(() -> users.save(User.builder()
                .publicId(UUID.randomUUID().toString())
                .fullName("Test " + role.name())
                .email(email)
                .phone("+8801" + Math.abs(email.hashCode() % 1_000_000_000L))
                .passwordHash(encoder.encode(PASSWORD))
                .role(role)
                .status("ACTIVE")
                .build()));
    }

    /** Convenience: create a user and return its bearer header in one call. */
    public static String bearerFor(UserRepository users, PasswordEncoder encoder, JwtService jwtService,
                                   String email, RoleType role) {
        return bearer(jwtService, user(users, encoder, email, role));
    }
}
