package com.turfchai.tournament.api;

import com.turfchai.tournament.config.TournamentDataSeeder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles({"test", "dev"})
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:player-tournament-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PlayerTournamentRestControllerTest {

    private static final String BASE = "/api/v1/tournaments";

    @Autowired
    private MockMvc mockMvc;

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
