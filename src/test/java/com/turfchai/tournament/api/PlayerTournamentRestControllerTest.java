package com.turfchai.tournament.api;

import com.turfchai.model.User;
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
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles({ "test", "dev" })
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
                "spring.datasource.url=jdbc:h2:mem:player-tournament-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
                "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlayerTournamentRestControllerTest {

        private static final String BASE = "/api/v1/tournaments";

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
        private JwtService jwtService;

        @BeforeEach
        void authenticateAsDemoPlayer() {
                User player = users.findByPublicId(PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString()).orElseThrow();
                mockMvc = MockMvcBuilders.webAppContextSetup(context)
                                .addFilters(securityFilterChain)
                                .defaultRequest(get("/").header(HttpHeaders.AUTHORIZATION,
                                                TestAuth.bearer(jwtService, player)))
                                .build();
        }

        /** TC-002: registration and withdrawal are not reachable anonymously. */
        @Test
        void anonymousCallersAreRejected() throws Exception {
                String code = TournamentDataSeeder.DEMO_CODE;
                anonymousMvc.perform(get(BASE)).andExpect(status().isUnauthorized());
                anonymousMvc.perform(get(BASE + "/me")).andExpect(status().isUnauthorized());
                anonymousMvc.perform(get(BASE + "/" + code)).andExpect(status().isUnauthorized());
                anonymousMvc.perform(post(BASE + "/" + code + "/register")
                                .header("X-User-Id", PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(registration("Ghost FC")))
                                .andExpect(status().isUnauthorized());
                anonymousMvc.perform(delete(BASE + "/" + code + "/register")
                                .header("X-User-Id", PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString()))
                                .andExpect(status().isUnauthorized());
        }

        private static String registration(String team) {
                return """
                                {"teamName":"%s","captainName":"Cap","contactPhone":"+8801700000001",
                                 "emergencyContact":"Next of kin +8801700000002","jerseyNumber":"10",
                                 "skillLevel":"INTERMEDIATE","medicalNotes":"none","agreedToRules":true}
                                """.formatted(team);
        }

        @Test
        void browseReturnsOnlyDiscoverableTournaments() throws Exception {
                // The seeded demo cup is INVITE_ONLY, so an open-only browse excludes it.
                mockMvc.perform(get(BASE).param("openOnly", "true"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.items.length()").value(0));

                mockMvc.perform(get(BASE).param("openOnly", "false").param("upcomingOnly", "false"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.totalItems").value(greaterThanOrEqualTo(1)))
                                .andExpect(jsonPath("$.items[0].code").value(TournamentDataSeeder.DEMO_CODE))
                                .andExpect(jsonPath("$.items[0].registeredTeams").value(13))
                                .andExpect(jsonPath("$.items[0].spotsLeft").value(3));
        }

        @Test
        void registrationLifecycle() throws Exception {
                mockMvc.perform(post(BASE + "/" + TournamentDataSeeder.DEMO_CODE + "/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(registration("Dashboard United")))
                                .andExpect(status().isCreated())
                                // Entry fee stays DUE — capture belongs to the payments module.
                                .andExpect(jsonPath("$.entryFeeStatus").value("DUE"))
                                .andExpect(jsonPath("$.registrationCode").exists());

                mockMvc.perform(get(BASE + "/me"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].myRegistrationCode").exists())
                                .andExpect(jsonPath("$[0].myPaymentStatus").value("DUE"));

                // Same team name twice -> 409
                mockMvc.perform(post(BASE + "/" + TournamentDataSeeder.DEMO_CODE + "/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(registration("dashboard united")))
                                .andExpect(status().isConflict());

                mockMvc.perform(delete(BASE + "/" + TournamentDataSeeder.DEMO_CODE + "/register"))
                                .andExpect(status().isNoContent());

                mockMvc.perform(get(BASE + "/me"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.length()").value(0));
        }

        /**
         * One entry per player. The read side resolves a player to a single team,
         * so a second registration under a different name used to leave the player
         * unable to withdraw: the withdrawal removed the earliest entry, and once
         * that one was paid it refused outright with the other still registered.
         */
        @Test
        void aPlayerCannotRegisterASecondTeam() throws Exception {
                String code = TournamentDataSeeder.DEMO_CODE;
                mockMvc.perform(post(BASE + "/" + code + "/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(registration("First Entry FC")))
                                .andExpect(status().isCreated());

                mockMvc.perform(post(BASE + "/" + code + "/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(registration("Second Entry FC")))
                                .andExpect(status().isConflict());

                // Still exactly one registration, and it is still withdrawable.
                mockMvc.perform(get(BASE + "/me"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.length()").value(1));
                mockMvc.perform(delete(BASE + "/" + code + "/register"))
                                .andExpect(status().isNoContent());
        }

        @Test
        void registrationRequiresAcceptingTheRules() throws Exception {
                mockMvc.perform(post(BASE + "/" + TournamentDataSeeder.DEMO_CODE + "/register")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"teamName\":\"No Consent FC\",\"agreedToRules\":false}"))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void withdrawingWithoutRegistrationReturns404() throws Exception {
                mockMvc.perform(delete(BASE + "/" + TournamentDataSeeder.DEMO_CODE + "/register"))
                                .andExpect(status().isNotFound());
        }

        @Test
        void unknownTournamentReturns404() throws Exception {
                mockMvc.perform(get(BASE + "/TR-CUP-0000"))
                                .andExpect(status().isNotFound());
        }
}
