package com.turfchai.service.impl;

import com.turfchai.config.JwtProperties;
import com.turfchai.service.OtpService;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InMemoryOtpService implements OtpService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final Map<String, OtpEntry> store = new ConcurrentHashMap<>();
    private final long ttlSeconds;

    public InMemoryOtpService(JwtProperties properties) {
        this.ttlSeconds = properties.otpTtlSeconds() > 0 ? properties.otpTtlSeconds() : 300;
    }

    @Override
    public String generateAndStore(String phone) {
        String code = String.format("%04d", RANDOM.nextInt(10000));
        store.put(normalize(phone), new OtpEntry(code, Instant.now().plusSeconds(ttlSeconds)));
        return code;
    }

    @Override
    public boolean isValid(String phone, String code) {
        OtpEntry entry = store.get(normalize(phone));
        if (entry == null) {
            return false;
        }
        if (entry.expiresAt().isBefore(Instant.now())) {
            store.remove(normalize(phone));
            return false;
        }
        boolean matches = entry.code().equals(code);
        if (matches) {
            store.remove(normalize(phone));
        }
        return matches;
    }

    private String normalize(String phone) {
        return phone == null ? "" : phone.replaceAll("[\\s\\-()]", "");
    }

    private record OtpEntry(String code, Instant expiresAt) {
    }
}
