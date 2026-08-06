package com.turfchai.admin.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private String uniqueEmail(String prefix) {
        return prefix + System.nanoTime() + "@turfchai.test";
    }

    private User createUser(String email, RoleType role) {
        User user = User.builder()
                .fullName("Test " + role)
                .email(email)
                .phone("+88017" + (10000000 + (int) (System.nanoTime() % 10000000)))
                .passwordHash(passwordEncoder.encode("TurfChai@123"))
                .role(role)
                .avatarInitials("TT")
                .build();
        return userRepository.save(user);
    }

    @Test
    void admin_login_issues_challenge_without_token_and_exposes_dev_code() throws Exception {
        User admin = createUser(uniqueEmail("admin"), RoleType.ADMIN);

        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"TurfChai@123\"}".formatted(admin.getEmail())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.challenge").isNotEmpty())
                .andExpect(jsonPath("$.sentTo").value(org.hamcrest.Matchers.containsString("@")))
                .andExpect(jsonPath("$.devCode").isNotEmpty())
                .andExpect(jsonPath("$.ttlSeconds").value(300));
    }

    @Test
    void admin_login_rejects_player_account() throws Exception {
        User player = createUser(uniqueEmail("player"), RoleType.PLAYER);

        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"TurfChai@123\"}".formatted(player.getEmail())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void admin_login_wrong_password_rejects() throws Exception {
        User admin = createUser(uniqueEmail("admin"), RoleType.SUPER_ADMIN);

        mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"WrongPassword@1\"}".formatted(admin.getEmail())))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void verify_with_dev_code_issues_token() throws Exception {
        User admin = createUser(uniqueEmail("admin"), RoleType.ADMIN);

        MvcResult challengeResult = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"TurfChai@123\"}".formatted(admin.getEmail())))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode challengeJson = objectMapper.readTree(challengeResult.getResponse().getContentAsString());
        String challenge = challengeJson.get("challenge").asText();
        String devCode = challengeJson.get("devCode").asText();

        mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challenge\":\"%s\",\"code\":\"%s\"}".formatted(challenge, devCode)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value(admin.getEmail()))
                .andExpect(jsonPath("$.user.role").value("ADMIN"));
    }

    @Test
    void verify_with_bad_code_rejects_and_challenge_is_single_use() throws Exception {
        User admin = createUser(uniqueEmail("admin"), RoleType.SUPER_ADMIN);

        MvcResult challengeResult = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"TurfChai@123\"}".formatted(admin.getEmail())))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode challengeJson = objectMapper.readTree(challengeResult.getResponse().getContentAsString());
        String challenge = challengeJson.get("challenge").asText();
        String devCode = challengeJson.get("devCode").asText();

        mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challenge\":\"%s\",\"code\":\"000000\"}".formatted(challenge)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Invalid verification code")));

        mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challenge\":\"%s\",\"code\":\"%s\"}".formatted(challenge, devCode)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challenge\":\"%s\",\"code\":\"%s\"}".formatted(challenge, devCode)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("expired or is unknown")));
    }

    @Test
    void verify_unknown_challenge_rejects() throws Exception {
        mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"challenge\":\"does-not-exist\",\"code\":\"123456\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("expired or is unknown")));
    }

    @Test
    void excessive_bad_attempts_burn_the_challenge() throws Exception {
        User admin = createUser(uniqueEmail("admin"), RoleType.ADMIN);

        MvcResult challengeResult = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"TurfChai@123\"}".formatted(admin.getEmail())))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode challengeJson = objectMapper.readTree(challengeResult.getResponse().getContentAsString());
        String challenge = challengeJson.get("challenge").asText();

        String verifyBody = "{\"challenge\":\"%s\",\"code\":\"000000\"}".formatted(challenge);
        for (int i = 0; i < 4; i++) {
            mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(verifyBody))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("attempts remaining")));
        }

        mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Too many failed attempts. Sign in again to receive a new code."));

        mockMvc.perform(post("/api/v1/admin/auth/login/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("This verification session has expired or is unknown. Sign in again."));
    }
}