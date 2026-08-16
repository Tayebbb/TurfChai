package com.turfchai.integrity;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.testsupport.TestAuth;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.web.FilterChainProxy;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.concurrent.ThreadLocalRandom;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * TC-014: the admin roster endpoint returned every account. On the demo
 * database that was 842 users and 421 KB in one response, which the browser
 * then rendered as ~17,000 DOM nodes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"test", "dev"})
class AdminUserPaginationTest {

    @Autowired WebApplicationContext context;
    @Autowired FilterChainProxy securityFilterChain;
    @Autowired UserRepository userRepository;
    @Autowired JwtService jwtService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        User admin = userRepository.save(User.builder()
                .fullName("Roster Admin")
                .email("roster.admin." + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .role(RoleType.ADMIN)
                .build());

        mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .addFilters(securityFilterChain)
                .defaultRequest(get("/").header(AUTHORIZATION, TestAuth.bearer(jwtService, admin)))
                .build();
    }

    @Test
    void returnsOnePageAndTheRealTotal() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users?page=0&size=10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(10))
                .andExpect(jsonPath("$.data.page").value(0))
                .andExpect(jsonPath("$.data.size").value(10))
                .andExpect(jsonPath("$.data.total").value(org.hamcrest.Matchers.greaterThan(10)));
    }

    @Test
    void defaultsToABoundedPageWhenNoSizeIsAskedFor() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(org.hamcrest.Matchers.lessThanOrEqualTo(25)));
    }

    @Test
    void refusesToReturnTheWholeRosterEvenWhenAsked() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users?size=100000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(org.hamcrest.Matchers.lessThanOrEqualTo(100)));
    }

    @Test
    void laterPagesReturnDifferentAccounts() throws Exception {
        String first = mockMvc.perform(get("/api/v1/admin/users?page=0&size=5"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String second = mockMvc.perform(get("/api/v1/admin/users?page=1&size=5"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(first).isNotEqualTo(second);
    }

    @Test
    void searchIsAppliedByTheDatabaseNotTheCaller() throws Exception {
        User needle = userRepository.save(User.builder()
                .fullName("Zzyzx Unmistakable")
                .email("zzyzx." + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .role(RoleType.PLAYER)
                .build());

        mockMvc.perform(get("/api/v1/admin/users?q=Zzyzx&page=0&size=25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].fullName").value(needle.getFullName()));
    }

    @Test
    void payoutSummaryReplacesDownloadingEveryPayout() throws Exception {
        mockMvc.perform(get("/api/v1/admin/payouts/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.settledAmount").exists())
                .andExpect(jsonPath("$.settledCount").exists());
    }
}
