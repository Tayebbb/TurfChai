package com.turfchai.admin.auth;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory store of pending admin-login challenges.
 * A challenge is single-use and expires after its TTL.
 */
@Component
public class AdminLoginChallengeStore {

    private final Map<String, ChallengeEntry> store = new ConcurrentHashMap<>();

    public void save(String challenge, ChallengeEntry entry) {
        store.put(challenge, entry);
    }

    public ChallengeEntry get(String challenge) {
        return store.get(challenge);
    }

    public void remove(String challenge) {
        store.remove(challenge);
    }

    public void clearExpired() {
        Instant now = Instant.now();
        store.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    public record ChallengeEntry(String code, Long userId, Instant expiresAt, int attempts) {
        public ChallengeEntry withAttempts(int newAttempts) {
            return new ChallengeEntry(code, userId, expiresAt, newAttempts);
        }
    }
}