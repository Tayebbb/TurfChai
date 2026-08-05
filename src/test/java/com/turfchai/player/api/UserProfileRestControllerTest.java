package com.turfchai.player.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:profile-api-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class UserProfileRestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void meDefaultsToDemoPlayer() throws Exception {
        mockMvc.perform(get("/api/v1/players/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Rafiul Karim"))
                .andExpect(jsonPath("$.email").value("rafi@turfchai.dev"));
    }

    @Test
    void unknownUserHeaderReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/players/me").header("X-User-Id", UUID.randomUUID().toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void malformedUserHeaderReturns400() throws Exception {
        mockMvc.perform(get("/api/v1/players/me").header("X-User-Id", "not-a-uuid"))
                .andExpect(status().isBadRequest());
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
