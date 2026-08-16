package com.turfchai.service.impl;

import com.turfchai.config.JwtProperties;
import com.turfchai.exception.OtpException;
import com.turfchai.service.OtpService;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InMemoryOtpService implements OtpService {

    private static final SecureRandom RANDOM = new SecureRandom();

    /** Throttle window for code requests against one phone number. */
    private static final long RATE_WINDOW_SECONDS = 600;
    private static final int MAX_CODES_PER_WINDOW = 5;
    private static final long MIN_RESEND_INTERVAL_SECONDS = 30;

    /** Wrong guesses allowed before the code is burned. */
    private static final int MAX_ATTEMPTS = 5;

    private final Map<String, OtpEntry> store = new ConcurrentHashMap<>();
    private final Map<String, RequestThrottle> throttles = new ConcurrentHashMap<>();
    private final long ttlSeconds;

    public InMemoryOtpService(JwtProperties properties) {
        this.ttlSeconds = properties.otpTtlSeconds() > 0 ? properties.otpTtlSeconds() : 300;
    }

    @Override
    public String generateAndStore(String phone) {
        String key = normalize(phone);
        enforceRateLimit(key);
        String code = String.format("%04d", RANDOM.nextInt(10000));
        store.put(key, new OtpEntry(code, Instant.now().plusSeconds(ttlSeconds), 0));
        return code;
    }

    @Override
    public boolean isValid(String phone, String code) {
        String key = normalize(phone);
        OtpEntry entry = store.get(key);
        if (entry == null) {
            return false;
        }
        if (entry.expiresAt().isBefore(Instant.now())) {
            store.remove(key);
            return false;
        }
        if (entry.code().equals(code)) {
            store.remove(key);
            return true;
        }
        // Burn the code after repeated wrong guesses so a 4-digit code cannot be
        // walked through exhaustively inside its 5-minute life.
        int attempts = entry.attempts() + 1;
        if (attempts >= MAX_ATTEMPTS) {
            store.remove(key);
        } else {
            store.put(key, new OtpEntry(entry.code(), entry.expiresAt(), attempts));
        }
        return false;
    }

    private void enforceRateLimit(String key) {
        long now = Instant.now().getEpochSecond();
        RequestThrottle current = throttles.get(key);
        if (current == null || now - current.windowStartSeconds() >= RATE_WINDOW_SECONDS) {
            throttles.put(key, new RequestThrottle(now, 1, now));
            return;
        }
        long sinceLast = now - current.lastAtSeconds();
        if (sinceLast < MIN_RESEND_INTERVAL_SECONDS) {
            throw new OtpException("Please wait " + (MIN_RESEND_INTERVAL_SECONDS - sinceLast)
                    + " seconds before requesting a new code.");
        }
        if (current.count() >= MAX_CODES_PER_WINDOW) {
            throw new OtpException("Too many verification codes requested. Try again later.");
        }
        throttles.put(key, new RequestThrottle(current.windowStartSeconds(), current.count() + 1, now));
    }

    private String normalize(String phone) {
        return phone == null ? "" : phone.replaceAll("[\\s\\-()]", "");
    }

    private record OtpEntry(String code, Instant expiresAt, int attempts) {
    }

    private record RequestThrottle(long windowStartSeconds, int count, long lastAtSeconds) {
    }
}
