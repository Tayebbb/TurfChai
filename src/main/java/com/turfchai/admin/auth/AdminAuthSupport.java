package com.turfchai.admin.auth;

import com.turfchai.config.JwtProperties;
import com.turfchai.dto.response.AuthResponse;
import com.turfchai.dto.response.UserResponse;
import com.turfchai.exception.InvalidCredentialsException;
import com.turfchai.exception.UserNotFoundException;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.security.UserPrincipal;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Bridge between the separated admin 2FA module and the shared auth/security
 * layer. This is the only place the admin module touches shared beans
 * ({@link AuthenticationManager}, {@link UserRepository}, {@link JwtService},
 * {@link JwtProperties}) so future changes to the shared layer land here alone.
 *
 * When the shared auth contract moves (e.g. token shape, principal model), adjust
 * only this class — never the admin module internals.
 */
@Component
public class AdminAuthSupport {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final AdminAuthProperties adminAuthProperties;
    private final String smtpHost;

    public AdminAuthSupport(
            AuthenticationManager authenticationManager,
            UserRepository userRepository,
            JwtService jwtService,
            JwtProperties jwtProperties,
            AdminAuthProperties adminAuthProperties,
            @org.springframework.beans.factory.annotation.Value("${spring.mail.host:}") String smtpHost) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.adminAuthProperties = adminAuthProperties;
        this.smtpHost = smtpHost;
    }

    /**
     * Authenticates an admin with email + password.
     *
     * @return the admin {@link User}
     * @throws InvalidCredentialsException for bad credentials or non-admin roles
     */
    public User authenticateAdmin(String email, String password) {
        final Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, password));
        } catch (Exception e) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        boolean isAdmin = user.getRole() == RoleType.ADMIN
                || user.getRole() == RoleType.SUPER_ADMIN;
        if (!isAdmin) {
            throw new InvalidCredentialsException("Invalid email or password");
        }
        return user;
    }

    public User findUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
    }

    /** Issues an access + refresh session for a user shaped into the shared AuthResponse. */
    public AuthResponse issueSession(User user) {
        String token = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        return new AuthResponse(token, "Bearer", jwtService.expirationMs(), refreshToken,
                jwtService.refreshExpirationMs(), toUserResponse(user));
    }

    public long otpTtlSeconds() {
        return jwtProperties.otpTtlSeconds() > 0 ? jwtProperties.otpTtlSeconds() : 300;
    }

    public boolean exposeDevCode() {
        // Dev-code is only a demo fallback: never expose it while a real
        // delivery channel (SMTP host) is configured, unless explicitly enabled.
        return adminAuthProperties.exposeDevCode()
                || smtpHost == null || smtpHost.isBlank();
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getPublicId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.getStatus(),
                user.getArea(),
                user.getAvatarUrl(),
                user.getAvatarInitials(),
                user.getBio(),
                user.getReliabilityScore(),
                user.getCreatedAt()
        );
    }
}