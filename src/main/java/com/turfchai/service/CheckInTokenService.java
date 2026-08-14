package com.turfchai.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * Mints and verifies the check-in payload carried by a match ticket's QR code.
 *
 * <p>A QR code is world-readable the moment it is shown or screenshotted, so
 * the token carries no personal data — only the ids needed to look the holder
 * up, plus the window it is good for. Its integrity comes from an HMAC, which
 * is what stops a player from editing a ticket into someone else's game.
 *
 * <p>The signing key is derived from the JWT secret rather than being the JWT
 * secret, so a ticket token can never be replayed as a session token even if
 * one of the two formats is later loosened.
 */
@Service
public class CheckInTokenService {

    private static final String ALGORITHM = "HmacSHA256";
    private static final String VERSION = "v1";
    private static final byte[] KEY_LABEL = "turfchai:check-in:v1".getBytes(StandardCharsets.UTF_8);

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final SecretKeySpec key;

    public CheckInTokenService(@Value("${app.jwt.secret}") String secret) {
        this.key = new SecretKeySpec(derive(secret), ALGORITHM);
    }

    /** The signed, self-describing payload a gate scanner reads. */
    public record CheckInToken(long gameId, long userId, Instant validFrom, Instant validUntil) {
    }

    /** @return the compact token string to encode into the QR code. */
    public String sign(CheckInToken token) {
        String payload = payloadOf(token);
        return payload + "." + ENCODER.encodeToString(hmac(payload));
    }

    /**
     * @return the token when the signature is intact, otherwise empty. A
     *         tampered, truncated or foreign token is indistinguishable from a
     *         missing one on purpose — the caller learns nothing about why.
     */
    public Optional<CheckInToken> verify(String candidate) {
        if (candidate == null || candidate.isBlank()) {
            return Optional.empty();
        }
        int split = candidate.lastIndexOf('.');
        if (split < 0) {
            return Optional.empty();
        }
        String payload = candidate.substring(0, split);
        byte[] presented;
        try {
            presented = DECODER.decode(candidate.substring(split + 1));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        // Constant-time: a byte-by-byte comparison would leak the signature.
        if (!MessageDigest.isEqual(hmac(payload), presented)) {
            return Optional.empty();
        }
        return parse(payload);
    }

    private static String payloadOf(CheckInToken token) {
        return VERSION + "." + token.gameId() + "." + token.userId() + "."
                + token.validFrom().getEpochSecond() + "." + token.validUntil().getEpochSecond();
    }

    private static Optional<CheckInToken> parse(String payload) {
        String[] parts = payload.split("\\.");
        if (parts.length != 5 || !VERSION.equals(parts[0])) {
            return Optional.empty();
        }
        try {
            return Optional.of(new CheckInToken(
                    Long.parseLong(parts[1]),
                    Long.parseLong(parts[2]),
                    Instant.ofEpochSecond(Long.parseLong(parts[3])),
                    Instant.ofEpochSecond(Long.parseLong(parts[4]))));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    private byte[] hmac(String payload) {
        try {
            // Mac is stateful, so it is created per call rather than shared.
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(key);
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Check-in token signing is unavailable", e);
        }
    }

    private static byte[] derive(String secret) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
            return mac.doFinal(KEY_LABEL);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Check-in token key derivation failed", e);
        }
    }
}
