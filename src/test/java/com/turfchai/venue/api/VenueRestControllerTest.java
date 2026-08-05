package com.turfchai.venue.api;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@org.springframework.test.context.ActiveProfiles({"test", "dev"})
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:venue-api-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class VenueRestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void searchReturnsPagedEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/venues").param("size", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.totalItems").isNumber())
                .andExpect(jsonPath("$.totalPages").isNumber());
    }

    @Test
    void exploreAliasWorks() throws Exception {
        mockMvc.perform(get("/api/v1/venues/explore"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void detailReturnsVenueWithPitchesAndPricing() throws Exception {
        mockMvc.perform(get("/api/v1/venues/kick-off-arena"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Kick Off Arena"))
                .andExpect(jsonPath("$.pitches").isArray())
                .andExpect(jsonPath("$.pricing").isArray());
    }

    @Test
    void unknownSlugReturns404Json() throws Exception {
        mockMvc.perform(get("/api/v1/venues/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void invalidPaginationParamsReturn400() throws Exception {
        mockMvc.perform(get("/api/v1/venues").param("size", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
        mockMvc.perform(get("/api/v1/venues").param("size", "500"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/venues").param("page", "-1"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void malformedFilterValuesReturn400() throws Exception {
        mockMvc.perform(get("/api/v1/venues").param("minPrice", "abc"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/v1/venues").param("openAt", "not-a-time"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void filtersApplyThroughHttpLayer() throws Exception {
        mockMvc.perform(get("/api/v1/venues")
                .param("area", "Dhanmondi")
                .param("sport", "football")
                .param("maxPrice", "3000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].slug").value("kick-off-arena"));
    }
}
