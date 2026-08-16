package com.turfchai.security;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.testsupport.TestAuth;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * `POST /api/v1/auth/otp/request` is public. It used to return the generated
 * code in the response body unconditionally, which meant anyone who knew a
 * phone number could request a code, read it from the response, verify it and
 * receive that account's JWT.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
                "spring.datasource.url=jdbc:h2:mem:otp-exposure-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "app.otp.expose-dev-code=false"
})
class OtpCodeExposureTest {

        @Autowired
        private MockMvc mvc;
        @Autowired
        private UserRepository users;
        @Autowired
        private PasswordEncoder encoder;

        private static final String PHONE = "+8801911100011";

        @Test
        @DisplayName("Requesting a code never returns it when dev-code exposure is off")
        void requestDoesNotLeakTheCode() throws Exception {
                mvc.perform(post("/api/v1/auth/otp/request")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"phone\":\"" + PHONE + "\"}"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.sent").value(true))
                                .andExpect(jsonPath("$.devCode").doesNotExist());
        }

        @Test
        @DisplayName("A guessed code cannot mint a session for someone else's account")
        void guessedCodeIsRejected() throws Exception {
                User victim = TestAuth.user(users, encoder, "otp.victim@turfchai.test", RoleType.PLAYER);
                victim.setPhone("+8801911100022");
                users.save(victim);

                mvc.perform(post("/api/v1/auth/otp/request")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"phone\":\"+8801911100022\"}"))
                                .andExpect(status().isOk());

                mvc.perform(post("/api/v1/auth/otp/verify")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"phone\":\"+8801911100022\",\"code\":\"0000\"}"))
                                .andExpect(status().is4xxClientError())
                                .andExpect(jsonPath("$.token").doesNotExist());
        }

        @Test
        @DisplayName("Codes cannot be requested in a tight loop for one number")
        void repeatedRequestsAreThrottled() throws Exception {
                String phone = "+8801911100033";
                mvc.perform(post("/api/v1/auth/otp/request")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"phone\":\"" + phone + "\"}"))
                                .andExpect(status().isOk());

                mvc.perform(post("/api/v1/auth/otp/request")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"phone\":\"" + phone + "\"}"))
                                .andExpect(status().is4xxClientError());
        }
}
