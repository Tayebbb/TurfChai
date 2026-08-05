package com.turfchai.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.config.JwtProperties;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtProperties jwtProperties;

    private String uniqueEmail(String prefix) {
        return prefix + System.nanoTime() + "@turfchai.test";
    }

    /** Builds a well-signed but already-expired access token for the given user. */
    private String expiredToken(String publicId) {
        SecretKey key = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(publicId)
                .issuer(jwtProperties.issuer())
                .issuedAt(Date.from(now.minusSeconds(3600)))
                .expiration(Date.from(now.minusSeconds(60)))
                .signWith(key)
                .compact();
    }

    @Test
    void register_then_login_returns_token() throws Exception {
        String email = uniqueEmail("player");
        String registerBody = """
                {"fullName":"Test Player","email":"%s","password":"Password@123","phone":"+8801700000111","role":"PLAYER"}
                """.formatted(email);

        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.role").value("PLAYER"))
                .andReturn();

        JsonNode registerResponse = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        assertThat(registerResponse.get("token").asText()).isNotBlank();

        String loginBody = """
                {"email":"%s","password":"Password@123"}
                """.formatted(email);
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(email));
    }

    @Test
    void register_duplicate_email_returns_conflict() throws Exception {
        String email = uniqueEmail("dup");
        String body = """
                {"fullName":"First User","email":"%s","password":"Password@123","phone":"+8801700000222","role":"PLAYER"}
                """.formatted(email);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("already exists")));
    }

    @Test
    void login_with_wrong_password_returns_unauthorized() throws Exception {
        String email = uniqueEmail("badpw");
        String registerBody = """
                {"fullName":"Bad Password","email":"%s","password":"Password@123","phone":"+8801700000333","role":"PLAYER"}
                """.formatted(email);
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated());

        String loginBody = """
                {"email":"%s","password":"WrongPassword@1"}
                """.formatted(email);
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void me_requires_valid_token() throws Exception {
        String email = uniqueEmail("meuser");
        String registerBody = """
                {"fullName":"Me User","email":"%s","password":"Password@123","phone":"+8801700000444","role":"PLAYER"}
                """.formatted(email);
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        String token = json.get("token").asText();

        mockMvc.perform(get("/api/v1/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
    }

    @Test
    void me_without_token_is_unauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void me_with_expired_token_is_unauthorized() throws Exception {
        String email = uniqueEmail("expired");
        String registerBody = """
                {"fullName":"Expired User","email":"%s","password":"Password@123","phone":"+8801700000555","role":"PLAYER"}
                """.formatted(email);
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        String publicId = json.get("user").get("publicId").asText();
        String expired = expiredToken(publicId);

        mockMvc.perform(get("/api/v1/me")
                        .header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void player_token_cannot_access_admin_endpoint() throws Exception {
        String email = uniqueEmail("forbidden");
        String registerBody = """
                {"fullName":"Forbidden User","email":"%s","password":"Password@123","phone":"+8801700000666","role":"PLAYER"}
                """.formatted(email);
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode json = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        String token = json.get("token").asText();

        mockMvc.perform(get("/api/v1/admin/admins")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void refresh_token_returns_fresh_access_token() throws Exception {
        String email = uniqueEmail("refresh");
        String registerBody = """
                {"fullName":"Refresh User","email":"%s","password":"Password@123","phone":"+8801700000777","role":"PLAYER"}
                """.formatted(email);
        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn();

        JsonNode json = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        String refreshToken = json.get("refreshToken").asText();

        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(refreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value(email));
    }

    @Test
    void refresh_token_with_bad_token_is_unauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"not-a-real-token\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void otp_verify_creates_user_and_returns_token() throws Exception {
        String phone = "+8801799999000";

        MvcResult otpResult = mockMvc.perform(post("/api/v1/auth/otp/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(true))
                .andExpect(jsonPath("$.devCode").isNotEmpty())
                .andReturn();

        JsonNode otpJson = objectMapper.readTree(otpResult.getResponse().getContentAsString());
        String devCode = otpJson.get("devCode").asText();

        String verifyBody = """
                {"phone":"%s","code":"%s","fullName":"Otp User"}
                """.formatted(phone, devCode);
        mockMvc.perform(post("/api/v1/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.phone").value(phone));
    }

    @Test
    void otp_verify_with_bad_code_rejects() throws Exception {
        String phone = "+8801799999111";
        mockMvc.perform(post("/api/v1/auth/otp/request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\"}"))
                .andExpect(status().isOk());

        String verifyBody = """
                {"phone":"%s","code":"0000","fullName":"Bad Otp"}
                """.formatted(phone);
        mockMvc.perform(post("/api/v1/auth/otp/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(verifyBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid or expired verification code"));
    }
}
