package com.turfchai.admin.auth;

import com.turfchai.admin.auth.dto.request.AdminLoginRequest;
import com.turfchai.admin.auth.dto.request.AdminLoginVerifyRequest;
import com.turfchai.admin.auth.dto.response.AdminLoginChallengeResponse;
import com.turfchai.dto.response.AuthResponse;
import com.turfchai.exception.OtpException;
import com.turfchai.model.User;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AdminAuthServiceImpl implements AdminAuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS = 5;
    private static final int MIN_RESEND_INTERVAL_SECONDS = 30;
    private static final int MAX_CHALLENGES_PER_WINDOW = 5;
    private static final long RATE_WINDOW_SECONDS = 900;
    private static final String TOO_MANY_ATTEMPTS = "Too many failed attempts. Sign in again to receive a new code.";

    private final AdminAuthSupport support;
    private final AdminLoginChallengeStore challengeStore;
    private final AdminOtpMailer otpMailer;
    private final Map<Long, ChallengeThrottle> throttles = new ConcurrentHashMap<>();

    public AdminAuthServiceImpl(
            AdminAuthSupport support,
            AdminLoginChallengeStore challengeStore,
            AdminOtpMailer otpMailer) {
        this.support = support;
        this.challengeStore = challengeStore;
        this.otpMailer = otpMailer;
    }

    private record ChallengeThrottle(long windowStartSeconds, int count, long lastAtSeconds) {
    }

    @Override
    public AdminLoginChallengeResponse challenge(AdminLoginRequest request) {
        String email = request.email().trim().toLowerCase();
        User admin = support.authenticateAdmin(email, request.password());

        enforceRateLimit(admin.getId());

        challengeStore.clearExpired();

        String challenge = UUID.randomUUID().toString();
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        long ttlSeconds = support.otpTtlSeconds();
        challengeStore.save(challenge, new AdminLoginChallengeStore.ChallengeEntry(
                code, admin.getId(), Instant.now().plusSeconds(ttlSeconds), 0));

        otpMailer.sendLoginCode(admin.getEmail(), code, ttlSeconds);

        return new AdminLoginChallengeResponse(
                challenge,
                maskEmail(admin.getEmail()),
                ttlSeconds,
                support.exposeDevCode() ? code : null,
                "A verification code was sent to " + maskEmail(admin.getEmail()));
    }

    /**
     * Throttles how many codes can be requested for a single admin:
     * at most one every {@code MIN_RESEND_INTERVAL_SECONDS} and at most
     * {@code MAX_CHALLENGES_PER_WINDOW} per {@code RATE_WINDOW_SECONDS}.
     */
    private void enforceRateLimit(Long userId) {
        long now = Instant.now().getEpochSecond();
        ChallengeThrottle current = throttles.get(userId);
        if (current == null) {
            throttles.put(userId, new ChallengeThrottle(now, 1, now));
            return;
        }
        if (now - current.windowStartSeconds() >= RATE_WINDOW_SECONDS) {
            throttles.put(userId, new ChallengeThrottle(now, 1, now));
            return;
        }
        if (now - current.lastAtSeconds() < MIN_RESEND_INTERVAL_SECONDS) {
            throw new OtpException("Please wait " + (MIN_RESEND_INTERVAL_SECONDS - (now - current.lastAtSeconds()))
                    + " seconds before requesting a new code.");
        }
        if (current.count() >= MAX_CHALLENGES_PER_WINDOW) {
            throw new OtpException("Too many verification codes requested. Try again later.");
        }
        throttles.put(userId, new ChallengeThrottle(now, current.count() + 1, now));
    }

    @Override
    public AuthResponse verify(AdminLoginVerifyRequest request) {
        String challenge = request.challenge().trim();
        AdminLoginChallengeStore.ChallengeEntry entry = challengeStore.get(challenge);
        if (entry == null) {
            throw new OtpException("This verification session has expired or is unknown. Sign in again.");
        }
        if (entry.expiresAt().isBefore(Instant.now())) {
            challengeStore.remove(challenge);
            throw new OtpException("This verification session has expired. Sign in again.");
        }

        String code = request.code().trim();
        boolean matches = MessageDigest.isEqual(
                entry.code().getBytes(StandardCharsets.UTF_8),
                code.getBytes(StandardCharsets.UTF_8));
        if (!matches) {
            int attempts = entry.attempts() + 1;
            if (attempts >= MAX_ATTEMPTS) {
                challengeStore.remove(challenge);
                throw new OtpException(TOO_MANY_ATTEMPTS);
            }
            challengeStore.save(challenge, entry.withAttempts(attempts));
            throw new OtpException("Invalid verification code. " + (MAX_ATTEMPTS - attempts) + " attempts remaining.");
        }

        challengeStore.remove(challenge);
        User admin = support.findUserById(entry.userId());
        return support.issueSession(admin);
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***";
        String local = email.substring(0, email.indexOf('@'));
        String domain = email.substring(email.indexOf('@'));
        if (local.length() <= 2) return local.charAt(0) + "***" + domain;
        return local.substring(0, 1) + "••••" + local.substring(local.length() - 1) + domain;
    }
}