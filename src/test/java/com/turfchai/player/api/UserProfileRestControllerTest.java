package com.turfchai.player.api;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.player.config.PlayerDataSeeder;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.testsupport.TestAuth;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@org.springframework.test.context.ActiveProfiles({ "test", "dev" })
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
                "spring.datasource.url=jdbc:h2:mem:profile-api-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
                "spring.jpa.hibernate.ddl-auto=create-drop"
})
class UserProfileRestControllerTest {

        private MockMvc mockMvc;

        /** Same context, no Authorization header — used for the anonymous cases. */
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

        private String otherPlayerToken;

        @BeforeEach
        void authenticateAsDemoPlayer() {
                User demo = users.findByPublicId(PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString()).orElseThrow();
                User other = TestAuth.user(users, encoder, "other.player@turfchai.test", RoleType.PLAYER);
                otherPlayerToken = TestAuth.bearer(jwtService, other);

                mockMvc = MockMvcBuilders.webAppContextSetup(context)
                                .addFilters(securityFilterChain)
                                .defaultRequest(get("/").header(HttpHeaders.AUTHORIZATION,
                                                TestAuth.bearer(jwtService, demo)))
                                .build();
        }

        @Test
        void meReturnsTheAuthenticatedPlayer() throws Exception {
                mockMvc.perform(get("/api/v1/players/me"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.fullName").value("Rafiul Karim"))
                                .andExpect(jsonPath("$.email").value("rafi@turfchai.dev"));
        }

        /** TC-001: every player route refuses an anonymous caller. */
        @Test
        void anonymousAccessIsRejectedOnEveryPlayerRoute() throws Exception {
                anonymousMvc.perform(get("/api/v1/players/me"))
                                .andExpect(status().isUnauthorized());
                anonymousMvc.perform(patch("/api/v1/players/me")
                                .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Pwned\"}"))
                                .andExpect(status().isUnauthorized());
                anonymousMvc.perform(get("/api/v1/players/me/saved-venues"))
                                .andExpect(status().isUnauthorized());
                anonymousMvc.perform(post("/api/v1/players/me/saved-venues/kick-off-arena"))
                                .andExpect(status().isUnauthorized());
                anonymousMvc.perform(delete("/api/v1/players/me/saved-venues/kick-off-arena"))
                                .andExpect(status().isUnauthorized());
        }

        /** TC-001: an anonymous caller cannot name a victim with X-User-Id. */
        @Test
        void anonymousCallerCannotImpersonateViaHeader() throws Exception {
                anonymousMvc.perform(get("/api/v1/players/me")
                                .header("X-User-Id", PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString()))
                                .andExpect(status().isUnauthorized());
                anonymousMvc.perform(patch("/api/v1/players/me")
                                .header("X-User-Id", PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"fullName\":\"TAKEOVER\"}"))
                                .andExpect(status().isUnauthorized());
        }

        /**
         * TC-001: an authenticated caller cannot switch identity with the header —
         * it is ignored entirely, so the response is still their own profile.
         */
        @Test
        void authenticatedCallerCannotSwitchIdentityViaHeader() throws Exception {
                mockMvc.perform(get("/api/v1/players/me")
                                .header("X-User-Id", UUID.randomUUID().toString()))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("rafi@turfchai.dev"));

                mockMvc.perform(get("/api/v1/players/me").header("X-User-Id", "not-a-uuid"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("rafi@turfchai.dev"));
        }

        /** A second player sees only their own profile on the same route. */
        @Test
        void eachPlayerSeesOnlyTheirOwnProfile() throws Exception {
                anonymousMvc.perform(get("/api/v1/players/me")
                                .header(HttpHeaders.AUTHORIZATION, otherPlayerToken))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("other.player@turfchai.test"));
        }

        @Test
        void malformedTokenIsRejected() throws Exception {
                anonymousMvc.perform(get("/api/v1/players/me")
                                .header(HttpHeaders.AUTHORIZATION, "Bearer not.a.jwt"))
                                .andExpect(status().isUnauthorized());
        }

        @Test
        void patchUpdatesProfile() throws Exception {
                mockMvc.perform(patch("/api/v1/players/me")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"area\":\"Uttara\",\"playStyle\":\"advanced\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.area").value("Uttara"))
                                .andExpect(jsonPath("$.playStyle").value("advanced"));
        }

        @Test
        void patchRejectsInvalidPlayStyle() throws Exception {
                mockMvc.perform(patch("/api/v1/players/me")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"playStyle\":\"legendary\"}"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").exists());
        }

        @Test
        void patchRejectsBlankFullName() throws Exception {
                mockMvc.perform(patch("/api/v1/players/me")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"fullName\":\"   \"}"))
                                .andExpect(status().isBadRequest())
                                .andExpect(jsonPath("$.error").exists());
        }

        @Test
        void deleteIsIdempotentAndAtomic() throws Exception {
                mockMvc.perform(delete("/api/v1/players/me/saved-venues/greenturf-mohammadpur"))
                                .andExpect(status().isNoContent()); // not saved -> still 204
                mockMvc.perform(post("/api/v1/players/me/saved-venues/greenturf-mohammadpur"))
                                .andExpect(status().isOk());
                mockMvc.perform(delete("/api/v1/players/me/saved-venues/greenturf-mohammadpur"))
                                .andExpect(status().isNoContent());
                mockMvc.perform(delete("/api/v1/players/me/saved-venues/greenturf-mohammadpur"))
                                .andExpect(status().isNoContent()); // repeat delete stays 204
        }

        @Test
        void savedVenueToggleFlow() throws Exception {
                // seeded venue from VenueDataSeeder
                mockMvc.perform(post("/api/v1/players/me/saved-venues/kick-off-arena"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.saved").value(true));

                mockMvc.perform(get("/api/v1/players/me/saved-venues"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[0].slug").value("kick-off-arena"));

                mockMvc.perform(delete("/api/v1/players/me/saved-venues/kick-off-arena"))
                                .andExpect(status().isNoContent());

                mockMvc.perform(get("/api/v1/players/me/saved-venues"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$").isEmpty());
        }

        @Test
        void togglingUnknownVenueReturns404() throws Exception {
                mockMvc.perform(post("/api/v1/players/me/saved-venues/ghost"))
                                .andExpect(status().isNotFound());
        }
}
