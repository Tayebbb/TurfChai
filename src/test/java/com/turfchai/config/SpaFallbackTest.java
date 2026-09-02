package com.turfchai.config;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Single-origin deployment regression guard.
 *
 * <p>The production jar serves the React bundle, so a deep link like
 * {@code /admin} must never 401 (the missing-permission bug the split
 * deployment shipped) and must serve the SPA shell whenever a bundle is on the
 * classpath. Whether a bundle is present depends on how the test run was
 * built ({@code mvn test} alone has none; a {@code package} first leaves one
 * in {@code target/classes}), so each assertion accepts the outcome that
 * matches the classpath state — and always rejects the 401.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
@AutoConfigureMockMvc
class SpaFallbackTest {

        private static boolean bundlePresent;

        @BeforeAll
        static void detectBundle() {
                bundlePresent = new ClassPathResource("/static/index.html").exists();
        }

        /** 404 when the jar has no bundle, 200 + the SPA shell when it does. */
        private static ResultMatcher clientRouteOutcome() {
                return bundlePresent
                                ? status().isOk()
                                : status().isNotFound();
        }

        private static ResultMatcher spaShell() {
                return bundlePresent
                                ? content().string(org.hamcrest.Matchers.containsString("<div id=\"root\">"))
                                : status().isNotFound();
        }

        @Autowired
        private MockMvc mvc;

        @Test
        @DisplayName("client routes fall through to the SPA entry — never a 401")
        void clientRoutesReachSpaEntry() throws Exception {
                mvc.perform(get("/admin")).andExpect(clientRouteOutcome());
                mvc.perform(get("/admin/login")).andExpect(clientRouteOutcome());
                mvc.perform(get("/admin/turfs/42")).andExpect(clientRouteOutcome());
                mvc.perform(get("/player")).andExpect(clientRouteOutcome());
                mvc.perform(get("/player/bookings/123")).andExpect(clientRouteOutcome());
                mvc.perform(get("/solo/open-games")).andExpect(clientRouteOutcome());
                mvc.perform(get("/host/tournament")).andExpect(clientRouteOutcome());
                mvc.perform(get("/owner/calendar")).andExpect(clientRouteOutcome());
                mvc.perform(get("/auth")).andExpect(clientRouteOutcome());
                mvc.perform(get("/")).andExpect(clientRouteOutcome());
        }

        @Test
        @DisplayName("the SPA shell is the real entry point, not an error page")
        void spaShellIsServedWhenBundled() throws Exception {
                mvc.perform(get("/admin")).andExpect(spaShell());
        }

        @Test
        @DisplayName("dotted non-route paths stay 404 — they would never match the router")
        void dottedPathsStay404() throws Exception {
                mvc.perform(get("/admin/not-a-file.txt")).andExpect(status().isNotFound());
        }
}
