package com.turfchai.service;

import com.turfchai.service.CheckInTokenService.CheckInToken;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class CheckInTokenServiceTest {

    private static final String SECRET = "test-secret-that-is-at-least-32-characters-long";

    private final CheckInTokenService service = new CheckInTokenService(SECRET);

    private static CheckInToken sampleToken() {
        Instant from = Instant.now().truncatedTo(ChronoUnit.SECONDS);
        return new CheckInToken(42L, 7L, from, from.plus(5, ChronoUnit.HOURS));
    }

    @Test
    @DisplayName("A signed token verifies back to exactly what was signed")
    void roundTrips() {
        CheckInToken original = sampleToken();

        Optional<CheckInToken> parsed = service.verify(service.sign(original));

        assertThat(parsed).contains(original);
    }

    @Test
    @DisplayName("Editing the holder out of a ticket invalidates it")
    void rejectsTamperedPayload() {
        String token = service.sign(sampleToken());
        // Swap the user id 7 for 8 while keeping the original signature.
        String forged = token.replaceFirst("^v1\\.42\\.7\\.", "v1.42.8.");
        assertThat(forged).isNotEqualTo(token);

        assertThat(service.verify(forged)).isEmpty();
    }

    @Test
    @DisplayName("A token signed with a different secret is refused")
    void rejectsForeignSignature() {
        String foreign = new CheckInTokenService("a-completely-different-secret-value-32ch")
                .sign(sampleToken());

        assertThat(service.verify(foreign)).isEmpty();
    }

    @Test
    @DisplayName("Malformed input is refused rather than throwing")
    void rejectsGarbage() {
        assertThat(service.verify(null)).isEmpty();
        assertThat(service.verify("")).isEmpty();
        assertThat(service.verify("not-a-token")).isEmpty();
        assertThat(service.verify("v1.42.7.0.0.!!!not-base64!!!")).isEmpty();
        assertThat(service.verify("v9.42.7.0.0." + service.sign(sampleToken()))).isEmpty();
    }

    @Test
    @DisplayName("The token carries no personal data beyond the ids needed to look the holder up")
    void carriesNoPersonalData() {
        String token = service.sign(sampleToken());

        // Payload is ids and timestamps only — a QR code is world-readable.
        assertThat(token).startsWith("v1.42.7.");
        assertThat(token.split("\\.")).hasSize(6);
    }
}
