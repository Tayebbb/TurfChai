package com.turfchai.api;

import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.testsupport.TestAuth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Covers the endpoints added to close feature-connectivity gaps: the wallet
 * ledger read, player statistics, and the open-game creation contract.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:connectivity-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class FeatureConnectivityTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository users;
    @Autowired
    private PasswordEncoder encoder;
    @Autowired
    private JwtService jwt;

    private String playerToken;

    @BeforeEach
    void setUp() {
        playerToken = TestAuth.bearer(jwt,
                TestAuth.user(users, encoder, "connectivity.player@turfchai.test", RoleType.PLAYER));
    }

    // ── Wallet ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Wallet history returns a balance and an entry list")
    void walletHistoryIsReadable() throws Exception {
        mvc.perform(get("/api/v1/rewards/wallet").header(HttpHeaders.AUTHORIZATION, playerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.balance").exists())
                .andExpect(jsonPath("$.data.entries").isArray());
    }

    @Test
    @DisplayName("Wallet history is not readable anonymously")
    void walletHistoryRequiresAuth() throws Exception {
        mvc.perform(get("/api/v1/rewards/wallet"))
                .andExpect(status().isUnauthorized());
    }

    // ── Player statistics ───────────────────────────────────────────────────

    @Test
    @DisplayName("A player with no history gets zeroes, never invented figures")
    void statsStartAtZero() throws Exception {
        mvc.perform(get("/api/v1/players/me/stats").header(HttpHeaders.AUTHORIZATION, playerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalBookings").value(0))
                .andExpect(jsonPath("$.completedBookings").value(0))
                .andExpect(jsonPath("$.venuesPlayed").value(0))
                .andExpect(jsonPath("$.favouriteVenueName").doesNotExist())
                .andExpect(jsonPath("$.bookingsByMonth").isArray());
    }

    @Test
    @DisplayName("Statistics are per-caller and need a session")
    void statsRequireAuth() throws Exception {
        mvc.perform(get("/api/v1/players/me/stats"))
                .andExpect(status().isUnauthorized());
    }

    // ── Open game creation ──────────────────────────────────────────────────

    @Test
    @DisplayName("Creating an open game no longer demands an organizer id the server ignores")
    void createOpenGameWithoutOrganizerId() throws Exception {
        String body = """
                {
                  "title": "Friday 7-a-side",
                  "venueId": 1,
                  "gameDate": "%s",
                  "startTime": "20:00:00",
                  "endTime": "21:30:00",
                  "skillLevel": "ALL_LEVELS",
                  "capacity": 10,
                  "pricePerPlayer": 250
                }
                """.formatted(java.time.LocalDate.now().plusDays(2));

        mvc.perform(post("/api/v1/solo/open-games")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Friday 7-a-side"));
    }

    @Test
    @DisplayName("Creating an open game still validates the fields the server needs")
    void createOpenGameRejectsIncompletePayload() throws Exception {
        mvc.perform(post("/api/v1/solo/open-games")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"No venue\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Anonymous visitors cannot post a game")
    void createOpenGameRequiresAuth() throws Exception {
        mvc.perform(post("/api/v1/solo/open-games")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\"}"))
                .andExpect(status().isUnauthorized());
    }
}
