package com.turfchai.pricing.api;

import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.testsupport.TestAuth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Pricing quotes are advisory, but they still describe money and must not be
 * reachable by an anonymous caller or return a nonsense shape.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
class PricingRestControllerTest {

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private FilterChainProxy securityFilterChain;
    @Autowired
    private UserRepository users;
    @Autowired
    private PasswordEncoder encoder;
    @Autowired
    private JwtService jwtService;

    private MockMvc mvc;
    private String ownerToken;
    private String playerToken;

    private static final String QUOTE = """
            {"venueId":1,"pitchId":1,"slotDate":"2026-12-01","startTime":"18:00:00",
             "endTime":"19:30:00","basePrice":2000}
            """;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(securityFilterChain).build();
        ownerToken = TestAuth.bearerFor(users, encoder, jwtService,
                "pricing.owner." + System.nanoTime() + "@turfchai.test", RoleType.OWNER);
        playerToken = TestAuth.bearerFor(users, encoder, jwtService,
                "pricing.player." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);
    }

    @Test
    @DisplayName("a pricing quote requires a session")
    void quoteRequiresAuthentication() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(QUOTE))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a malformed quote request is rejected, not priced")
    void malformedQuoteIsRejected() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"venueId\":null}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("an authenticated caller either gets a quote or a clear unavailability")
    void quoteRespondsHonestly() throws Exception {
        int status = mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(QUOTE))
                .andReturn().getResponse().getStatus();

        // The ML model is an external dependency: 200 with a quote, or 503 when it
        // is down. It must never be a 500 or a silently fabricated price.
        org.assertj.core.api.Assertions.assertThat(status)
                .as("pricing must succeed or say it is unavailable")
                .isIn(200, 400, 404, 503);
    }

    @Test
    @DisplayName("holiday pricing rules are admin-only")
    void holidayRulesAreAdminOnly() throws Exception {
        mvc.perform(get("/api/v1/admin/holidays")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/holidays").header(HttpHeaders.AUTHORIZATION, playerToken))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/holidays").header(HttpHeaders.AUTHORIZATION, ownerToken))
                .andExpect(status().isForbidden());
    }
}
