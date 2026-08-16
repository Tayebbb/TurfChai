package com.turfchai.tournament.api;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.player.config.PlayerDataSeeder;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.testsupport.TestAuth;
import com.turfchai.tournament.config.TournamentDataSeeder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@org.springframework.test.context.ActiveProfiles({"test", "dev"})
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:tournament-api-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class TournamentRestControllerTest {

    private static final String BASE = "/api/v1/host/tournaments";
    private static final String CREATE_BODY = """
            {"name":"API Cup","venueSlug":"kick-off-arena","date":"2027-09-04",
             "windowStart":"08:00","windowEnd":"18:00","format":"knockout",
             "teamCapacity":8,"entryFeePerTeam":2000,"prizePool":0,"privacy":"open"}
            """;

    /** Authenticated as the seeded host of the demo tournament. */
    private MockMvc mockMvc;

    @Autowired
    private MockMvc anonymousMvc;
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

    private String outsiderToken;

    @BeforeEach
    void authenticateAsHost() {
        User host = users.findByPublicId(PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString()).orElseThrow();
        outsiderToken = TestAuth.bearerFor(users, encoder, jwtService,
                "outsider.host@turfchai.test", RoleType.HOST);

        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(securityFilterChain)
                .defaultRequest(get("/").header(HttpHeaders.AUTHORIZATION, TestAuth.bearer(jwtService, host)))
                .build();
    }

    /** TC-002: no host route is reachable without a token. */
    @Test
    void anonymousCallersAreRejectedOnEveryHostRoute() throws Exception {
        String code = TournamentDataSeeder.DEMO_CODE;
        anonymousMvc.perform(get(BASE + "/" + code)).andExpect(status().isUnauthorized());
        anonymousMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                .andExpect(status().isUnauthorized());
        anonymousMvc.perform(post(BASE + "/" + code + "/teams/1/entry-fee"))
                .andExpect(status().isUnauthorized());
        anonymousMvc.perform(post(BASE + "/" + code + "/fixtures/generate"))
                .andExpect(status().isUnauthorized());
        anonymousMvc.perform(get(BASE + "/" + code + "/fixtures"))
                .andExpect(status().isUnauthorized());
        anonymousMvc.perform(post(BASE + "/" + code + "/multi-pitch-reserve")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"slots\":[]}"))
                .andExpect(status().isUnauthorized());
    }

    /** TC-002: an X-User-Id header must not stand in for a token. */
    @Test
    void spoofedUserHeaderDoesNotAuthenticate() throws Exception {
        anonymousMvc.perform(post(BASE + "/" + TournamentDataSeeder.DEMO_CODE + "/fixtures/generate")
                        .header("X-User-Id", PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString()))
                .andExpect(status().isUnauthorized());
    }

    /** TC-002: knowing a tournament code is not authority over it. */
    @Test
    void authenticatedNonHostCannotTouchSomeoneElsesTournament() throws Exception {
        String code = TournamentDataSeeder.DEMO_CODE;
        anonymousMvc.perform(get(BASE + "/" + code).header(HttpHeaders.AUTHORIZATION, outsiderToken))
                .andExpect(status().isForbidden());
        anonymousMvc.perform(post(BASE + "/" + code + "/teams/1/entry-fee")
                        .header(HttpHeaders.AUTHORIZATION, outsiderToken))
                .andExpect(status().isForbidden());
        anonymousMvc.perform(post(BASE + "/" + code + "/fixtures/generate")
                        .header(HttpHeaders.AUTHORIZATION, outsiderToken))
                .andExpect(status().isForbidden());
        anonymousMvc.perform(post(BASE + "/" + code + "/teams")
                        .header(HttpHeaders.AUTHORIZATION, outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Ghost\"}"))
                .andExpect(status().isForbidden());
    }

    /** A host's own list must contain only their tournaments. */
    @Test
    void hostListsOnlyOwnTournaments() throws Exception {
        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString(TournamentDataSeeder.DEMO_CODE)));

        // A different host hosts nothing, so the same route must come back empty
        // rather than leaking somebody else's tournament.
        anonymousMvc.perform(get(BASE).header(HttpHeaders.AUTHORIZATION, outsiderToken))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString(TournamentDataSeeder.DEMO_CODE))));
    }

    private String createTournament() throws Exception {
        MvcResult result = mockMvc.perform(post(BASE)
                        .contentType(MediaType.APPLICATION_JSON).content(CREATE_BODY))
                .andExpect(status().isCreated())
                .andReturn();
        Matcher m = Pattern.compile("\"code\":\"(TR-CUP-\\d{4})\"")
                .matcher(result.getResponse().getContentAsString());
        if (!m.find()) {
            throw new AssertionError("No tournament code in response");
        }
        return m.group(1);
    }

    @Test
    void seededTournamentIsServed() throws Exception {
        mockMvc.perform(get(BASE + "/" + TournamentDataSeeder.DEMO_CODE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ramadan Cup 2027"))
                .andExpect(jsonPath("$.venueSlug").value("mirpur-sports-city"))
                .andExpect(jsonPath("$.teams.length()").value(13))
                .andExpect(jsonPath("$.reservations.length()").value(13))
                .andExpect(jsonPath("$.fixtures.length()").value(greaterThan(0)))
                .andExpect(jsonPath("$.costs.slotCount").value(13));
    }

    @Test
    void unknownCodeReturns404() throws Exception {
        mockMvc.perform(get(BASE + "/TR-CUP-0000"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createValidatesPayload() throws Exception {
        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"venueSlug\":\"kick-off-arena\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void teamRegistrationLifecycle() throws Exception {
        String code = createTournament();
        mockMvc.perform(post(BASE + "/" + code + "/teams")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Alpha\",\"captainName\":\"Cap\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entryFeeStatus").value("DUE"));

        // Duplicate name -> 409
        mockMvc.perform(post(BASE + "/" + code + "/teams")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"alpha\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void multiPitchReserveDetectsConflicts() throws Exception {
        String code = createTournament();
        String pitchId = firstPitchIdOf("kick-off-arena");

        String slotBody = """
                {"slots":[{"pitchId":%s,"startTime":"08:00","endTime":"10:00"}]}
                """.formatted(pitchId);
        mockMvc.perform(post(BASE + "/" + code + "/multi-pitch-reserve")
                        .contentType(MediaType.APPLICATION_JSON).content(slotBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reservations.length()").value(1))
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        // Overlapping window -> 409 with an explanatory error
        String overlap = """
                {"slots":[{"pitchId":%s,"startTime":"09:00","endTime":"11:00"}]}
                """.formatted(pitchId);
        mockMvc.perform(post(BASE + "/" + code + "/multi-pitch-reserve")
                        .contentType(MediaType.APPLICATION_JSON).content(overlap))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void fixtureGenerationEndpointRequiresPaidTeams() throws Exception {
        String code = createTournament();
        mockMvc.perform(post(BASE + "/" + code + "/fixtures/generate"))
                .andExpect(status().isConflict());
    }

    @Test
    void seededFixturesAreListed() throws Exception {
        mockMvc.perform(get(BASE + "/" + TournamentDataSeeder.DEMO_CODE + "/fixtures"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].roundLabel").value("R16"));
    }

    @Autowired
    private com.turfchai.venue.repository.PitchRepository pitches;

    private String firstPitchIdOf(String slug) {
        return pitches.findByVenueSlug(slug).stream()
                .findFirst().orElseThrow().getId().toString();
    }
}
