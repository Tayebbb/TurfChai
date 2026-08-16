package com.turfchai.promotion.api;

import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.testsupport.TestAuth;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Promotions are venue-scoped money-off rules, so who may edit them matters. */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
class PromotionRestControllerTest {

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
    @Autowired
    private VenueRepository venues;

    private MockMvc mvc;
    private String ownerToken;
    private String otherOwnerToken;
    private String playerToken;
    private Long venueId;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).addFilters(securityFilterChain).build();

        var owner = TestAuth.user(users, encoder,
                "promo.owner." + System.nanoTime() + "@turfchai.test", RoleType.OWNER);
        ownerToken = TestAuth.bearer(jwtService, owner);
        otherOwnerToken = TestAuth.bearerFor(users, encoder, jwtService,
                "promo.other." + System.nanoTime() + "@turfchai.test", RoleType.OWNER);
        playerToken = TestAuth.bearerFor(users, encoder, jwtService,
                "promo.player." + System.nanoTime() + "@turfchai.test", RoleType.PLAYER);

        venueId = venues.save(Venue.builder()
                .slug("promo-venue-" + System.nanoTime())
                .name("Promo Venue")
                .address("Addr")
                .area("Dhanmondi")
                .owner(owner)
                .build()).getId();
    }

    private String promotionBody(String code, int percent) {
        return """
                {"code":"%s","label":"Off-peak deal","discountType":"PERCENT","discountValue":%d,
                 "startsOn":"2026-09-01","endsOn":"2026-12-31","active":true}
                """.formatted(code, percent);
    }

    @Test
    @DisplayName("an owner can create and list promotions for their own venue")
    void ownerManagesOwnPromotions() throws Exception {
        mvc.perform(post("/api/v1/owner/venues/" + venueId + "/promotions")
                        .header(HttpHeaders.AUTHORIZATION, ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionBody("E2EPROMO", 20)))
                .andExpect(status().is2xxSuccessful());

        mvc.perform(get("/api/v1/owner/venues/" + venueId + "/promotions")
                        .header(HttpHeaders.AUTHORIZATION, ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("E2EPROMO"));
    }

    @Test
    @DisplayName("a player cannot create a promotion")
    void playersCannotCreatePromotions() throws Exception {
        mvc.perform(post("/api/v1/owner/venues/" + venueId + "/promotions")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionBody("PLAYERPROMO", 90)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("anonymous callers cannot manage promotions")
    void anonymousCannotManagePromotions() throws Exception {
        mvc.perform(get("/api/v1/owner/venues/" + venueId + "/promotions"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/owner/venues/" + venueId + "/promotions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionBody("ANON", 50)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a promotion edit is validated rather than accepted blindly")
    void promotionUpdateIsValidated() throws Exception {
        String created = mvc.perform(post("/api/v1/owner/venues/" + venueId + "/promotions")
                        .header(HttpHeaders.AUTHORIZATION, ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionBody("VALIDATE", 15)))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();

        Long id = Long.valueOf(created.replaceAll(".*\"id\"\\s*:\\s*(\\d+).*", "$1"));

        // A negative discount is not a discount.
        mvc.perform(patch("/api/v1/owner/venues/" + venueId + "/promotions/" + id)
                        .header(HttpHeaders.AUTHORIZATION, ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"discountValue\":-5}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("another owner cannot touch this venue's promotions")
    void promotionsAreVenueScoped() throws Exception {
        mvc.perform(post("/api/v1/owner/venues/" + venueId + "/promotions")
                        .header(HttpHeaders.AUTHORIZATION, otherOwnerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionBody("HIJACK", 99)))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("code validation is public and refuses an unknown code")
    void validateCodeIsPublicAndHonest() throws Exception {
        // Public on purpose: checkout needs it before a session exists. It must
        // still refuse a code that does not exist rather than discounting.
        mvc.perform(post("/api/v1/promotions/validate-code")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"NOT-A-REAL-CODE\",\"orderTotal\":2000}"))
                .andExpect(status().isUnprocessableEntity());
    }
}
