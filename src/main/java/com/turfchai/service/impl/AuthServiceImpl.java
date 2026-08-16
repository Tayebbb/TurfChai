package com.turfchai.service.impl;

import com.turfchai.dto.request.LoginRequest;
import com.turfchai.dto.request.OtpRequest;
import com.turfchai.dto.request.OtpVerifyRequest;
import com.turfchai.dto.request.RegisterRequest;
import com.turfchai.dto.request.UpdateProfileRequest;
import com.turfchai.dto.response.AuthResponse;
import com.turfchai.dto.response.OtpRequestResponse;
import com.turfchai.dto.response.UserResponse;
import com.turfchai.exception.AdminRoleNotAllowedException;
import com.turfchai.exception.EmailAlreadyExistsException;
import com.turfchai.exception.InvalidCredentialsException;
import com.turfchai.exception.OtpException;
import com.turfchai.exception.PhoneAlreadyExistsException;
import com.turfchai.exception.UserNotFoundException;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.AuthService;
import com.turfchai.service.OtpService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final OtpService otpService;
    private final com.turfchai.admin.auth.AdminAuthProperties otpProperties;

    @Override
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        String phone = request.phone().trim();
        String roleName = request.role() != null ? request.role().trim().toUpperCase() : RoleType.PLAYER.name();

        if (userRepository.findByEmail(email).isPresent()) {
            throw new EmailAlreadyExistsException("An account already exists with email: " + email);
        }
        if (userRepository.findByPhone(phone).isPresent()) {
            throw new PhoneAlreadyExistsException("An account already exists with phone: " + phone);
        }

        RoleType role = parseRole(roleName);

        if (role == RoleType.ADMIN || role == RoleType.SUPER_ADMIN) {
            throw new AdminRoleNotAllowedException(
                    "Admin accounts cannot be self-registered. Only a super admin can appoint them.");
        }

        User user = User.builder()
                .fullName(request.fullName().trim())
                .email(email)
                .phone(phone)
                .passwordHash(passwordEncoder.encode(request.password()))
                .role(role)
                .avatarInitials(initials(request.fullName()))
                .build();

        User saved = userRepository.save(user);
        return toAuthResponse(saved);
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.password()));
        } catch (Exception e) {
            throw new InvalidCredentialsException("Invalid email or password");
        }

        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        return toAuthResponse(user);
    }

    /**
     * Issues a login code for a phone number.
     *
     * <p>The code is only echoed back to the caller when dev-code exposure is
     * switched on. This endpoint is public, so returning the code
     * unconditionally would let anyone sign in as any account whose phone number
     * they know.
     */
    @Override
    @Transactional
    public OtpRequestResponse requestOtp(OtpRequest request) {
        String phone = request.phone().trim();
        String code = otpService.generateAndStore(phone);
        boolean exposeCode = otpProperties.exposeDevCode();
        return new OtpRequestResponse(true, "Verification code sent to " + maskPhone(phone), 300,
                exposeCode ? code : null);
    }

    @Override
    @Transactional
    public AuthResponse verifyOtp(OtpVerifyRequest request) {
        String phone = request.phone().trim();
        if (!otpService.isValid(phone, request.code().trim())) {
            throw new OtpException("Invalid or expired verification code");
        }

        User user = userRepository.findByPhone(phone).orElse(null);
        if (user == null) {
            if (request.fullName() == null || request.fullName().isBlank()) {
                throw new OtpException("No account found for this phone. Provide your name to create one.");
            }
            user = User.builder()
                    .fullName(request.fullName().trim())
                    .email(placeholderEmail(phone))
                    .phone(phone)
                    .passwordHash(passwordEncoder.encode("")) // OTP users cannot log in by password
                    .role(request.role() != null ? parseRole(request.role()) : RoleType.PLAYER)
                    .avatarInitials(initials(request.fullName()))
                    .build();
            user = userRepository.save(user);
        }
        return toAuthResponse(user);
    }

    @Override
    @Transactional(readOnly = true)
    public AuthResponse refreshToken(String refreshToken) {
        if (!jwtService.isValidRefreshToken(refreshToken)) {
            throw new InvalidCredentialsException("Invalid or expired refresh token");
        }
        String publicId = jwtService.extractPublicId(refreshToken);
        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new InvalidCredentialsException("Invalid or expired refresh token"));
        return toAuthResponse(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(String publicId) {
        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));
        return toUserResponse(user);
    }

    @Override
    public boolean checkEmail(String email) {
        if (email == null || email.trim().isEmpty()) {
            return false;
        }
        return userRepository.findByEmail(email.trim().toLowerCase()).isPresent();
    }

    @Override
    @Transactional
    public UserResponse updateProfile(String publicId, UpdateProfileRequest request) {
        User user = userRepository.findByPublicId(publicId)
                .orElseThrow(() -> new UserNotFoundException("User not found"));

        String email = request.email().trim().toLowerCase();
        String phone = request.phone().trim();
        String fullName = request.fullName().trim();

        if (!user.getEmail().equals(email) && userRepository.findByEmail(email).isPresent()) {
            throw new EmailAlreadyExistsException("An account already exists with email: " + email);
        }
        if (!user.getPhone().equals(phone) && userRepository.findByPhone(phone).isPresent()) {
            throw new PhoneAlreadyExistsException("An account already exists with phone: " + phone);
        }

        user.setFullName(fullName);
        user.setEmail(email);
        user.setPhone(phone);
        user.setAvatarInitials(initials(fullName));

        return toUserResponse(userRepository.save(user));
    }

    private AuthResponse toAuthResponse(User user) {
        String token = jwtService.generateToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);
        return new AuthResponse(
                token,
                "Bearer",
                jwtServiceExpirationMs(),
                refreshToken,
                jwtService.refreshExpirationMs(),
                toUserResponse(user));
    }

    private long jwtServiceExpirationMs() {
        // Expiration is read back from the token so it always matches the config.
        return jwtService.expirationMs();
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

    private RoleType parseRole(String roleName) {
        try {
            return RoleType.valueOf(roleName);
        } catch (IllegalArgumentException e) {
            return RoleType.PLAYER;
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "••••";
        return "•••• " + phone.substring(phone.length() - 4);
    }

    private String placeholderEmail(String phone) {
        return phone.replaceAll("[^0-9]", "") + "@otp.turfchai.local";
    }

    private String initials(String fullName) {
        if (fullName == null || fullName.isBlank()) return "??";
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    }
}
