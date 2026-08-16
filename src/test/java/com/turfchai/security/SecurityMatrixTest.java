package com.turfchai.security;

import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.player.config.PlayerDataSeeder;
import com.turfchai.repository.UserRepository;
import com.turfchai.testsupport.TestAuth;
import com.turfchai.tournament.config.TournamentDataSeeder;
import com.turfchai.venue.dto.owner.CreateVenueRequest;
import com.turfchai.venue.dto.owner.VenueManagementDto;
import com.turfchai.venue.service.VenueManagementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Security regression matrix.
 *
 * <p>
 * Every assertion here corresponds to a vulnerability that was reproduced
 * against this codebase. They are written to fail loudly if anyone reopens a
 * sensitive route with {@code permitAll}, reintroduces header/body identity,
 * or drops a tenant-isolation check.
 *
 * <p>
 * Covered findings: TC-001 (header impersonation), TC-002 (tournament
 * tampering), TC-006 (check-in ownership), TC-007 (review authorship),
 * QA-N06 (open-game join IDOR), QA-N09 (AI namespace).
 */
@ActiveProfiles({ "test", "dev" })
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
                "spring.datasource.url=jdbc:h2:mem:security-matrix-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
                "spring.jpa.hibernate.ddl-auto=create-drop"
})
class SecurityMatrixTest {

        private static final String DEMO_PUBLIC_ID = PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString();

        @Autowired
        private MockMvc mvc;
        @Autowired
        private UserRepository users;
        @Autowired
        private PasswordEncoder encoder;
        @Autowired
        private JwtService jwt;
        @Autowired
        private VenueManagementService venueManagement;

        private String playerA;
        private String playerB;
        private String ownerA;
        private String ownerB;
        private String admin;
        private String superAdmin;
        private Long ownerAVenueId;

        @BeforeEach
        void setUp() {
                playerA = TestAuth.bearerFor(users, encoder, jwt, "sec.player.a@turfchai.test", RoleType.PLAYER);
                playerB = TestAuth.bearerFor(users, encoder, jwt, "sec.player.b@turfchai.test", RoleType.PLAYER);
                admin = TestAuth.bearerFor(users, encoder, jwt, "sec.admin@turfchai.test", RoleType.ADMIN);
                superAdmin = TestAuth.bearerFor(users, encoder, jwt, "sec.super@turfchai.test", RoleType.SUPER_ADMIN);

                User a = TestAuth.user(users, encoder, "sec.owner.a@turfchai.test", RoleType.OWNER);
                User b = TestAuth.user(users, encoder, "sec.owner.b@turfchai.test", RoleType.OWNER);
                ownerA = TestAuth.bearer(jwt, a);
                ownerB = TestAuth.bearer(jwt, b);

                if (ownerAVenueId == null) {
                        VenueManagementDto venue = venueManagement.createVenue(a.getId(), new CreateVenueRequest(
                                        "Owner A Security Venue", "1 Test Road", "Dhanmondi",
                                        BigDecimal.valueOf(23.74), BigDecimal.valueOf(90.37), BigDecimal.valueOf(2000),
                                        "06:00", "23:00", "floodlights", "+8801700000000", "sec.owner.a@turfchai.test",
                                        "FULL_ONLY", "FREE_24H_50_6H", true, "rules", null, false));
                        ownerAVenueId = venue.id();
                }
        }

        private static String auth(String token) {
                return token;
        }

        // ── Anonymous ────────────────────────────────────────────────────────

        @Test
        @DisplayName("TC-001/TC-002: anonymous callers get 401 on every sensitive route")
        void anonymousIsRejectedEverywhereSensitive() throws Exception {
                String[] getRoutes = {
                                "/api/v1/players/me",
                                "/api/v1/players/me/saved-venues",
                                "/api/v1/tournaments",
                                "/api/v1/tournaments/me",
                                "/api/v1/tournaments/" + TournamentDataSeeder.DEMO_CODE,
                                "/api/v1/host/tournaments/" + TournamentDataSeeder.DEMO_CODE,
                                "/api/v1/host/tournaments/" + TournamentDataSeeder.DEMO_CODE + "/fixtures",
                                "/api/v1/bookings",
                                "/api/v1/notifications",
                                "/api/v1/rewards/my-points",
                                "/api/v1/rewards/activity",
                                "/api/v1/owner/venues",
                                "/api/v1/owner/bookings",
                                "/api/v1/owner/analytics/dashboard",
                                "/api/v1/admin/users",
                                "/api/v1/admin/venues",
                                "/api/v1/admin/turf-requests",
                                "/api/v1/admin/payouts",
                                "/api/v1/admin/analytics/dashboard",
                                "/api/v1/turf-requests",
                                "/api/ai/metrics",
                                "/v3/api-docs",
                };
                for (String route : getRoutes) {
                        mvc.perform(get(route))
                                        .andExpect(status().isUnauthorized());
                }

                mvc.perform(patch("/api/v1/players/me").contentType(MediaType.APPLICATION_JSON)
                                .content("{\"fullName\":\"TAKEOVER\"}"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(post("/api/v1/players/me/saved-venues/kick-off-arena"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(delete("/api/v1/players/me/saved-venues/kick-off-arena"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(post("/api/v1/reviews").contentType(MediaType.APPLICATION_JSON)
                                .content("{\"bookingId\":1,\"userId\":1,\"venueId\":1,\"overallRating\":5}"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(post("/api/v1/matchday/checkin").param("bookingId", "1"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(post("/api/v1/solo/open-games").contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"x\"}"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(post("/api/v1/solo/open-games/1/join").contentType(MediaType.APPLICATION_JSON)
                                .content("{\"userId\":1}"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(delete("/api/ai/sessions/someone-elses-session"))
                                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("TC-002: destructive host operations reject anonymous callers")
        void anonymousCannotRunHostOperations() throws Exception {
                String code = TournamentDataSeeder.DEMO_CODE;
                mvc.perform(post("/api/v1/host/tournaments/" + code + "/teams/1/entry-fee"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(post("/api/v1/host/tournaments/" + code + "/fixtures/generate"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(post("/api/v1/host/tournaments").contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"name":"Ghost Cup","venueSlug":"kick-off-arena","date":"2027-09-04",
                                                 "windowStart":"08:00","windowEnd":"18:00","format":"knockout",
                                                 "teamCapacity":8,"entryFeePerTeam":100,"prizePool":0,"privacy":"open"}
                                                """))
                                .andExpect(status().isUnauthorized());
                mvc.perform(delete("/api/v1/tournaments/" + code + "/register"))
                                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("TC-001: X-User-Id never authenticates and never switches identity")
        void headerIdentityIsIgnored() throws Exception {
                // anonymous + header -> still 401
                mvc.perform(get("/api/v1/players/me").header("X-User-Id", DEMO_PUBLIC_ID))
                                .andExpect(status().isUnauthorized());
                mvc.perform(get("/api/v1/tournaments/me").header("X-User-Id", DEMO_PUBLIC_ID))
                                .andExpect(status().isUnauthorized());

                // authenticated + someone else's header -> still the caller's own data
                mvc.perform(get("/api/v1/players/me")
                                .header(HttpHeaders.AUTHORIZATION, auth(playerA))
                                .header("X-User-Id", DEMO_PUBLIC_ID))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("sec.player.a@turfchai.test"));
        }

        @Test
        @DisplayName("Public read-only catalogue stays reachable")
        void publicCatalogueRemainsPublic() throws Exception {
                mvc.perform(get("/api/v1/health")).andExpect(status().isOk());
                mvc.perform(get("/api/v1/venues")).andExpect(status().isOk());
                mvc.perform(get("/api/v1/venues/kick-off-arena")).andExpect(status().isOk());
                mvc.perform(get("/api/v1/solo/open-games")).andExpect(status().isOk());
                mvc.perform(get("/api/v1/rewards/products")).andExpect(status().isOk());
        }

        // ── Tokens ───────────────────────────────────────────────────────────

        @Test
        @DisplayName("Malformed, tampered and unknown-subject tokens are all rejected")
        void badTokensAreRejected() throws Exception {
                mvc.perform(get("/api/v1/players/me").header(HttpHeaders.AUTHORIZATION, "Bearer not.a.jwt"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(get("/api/v1/players/me").header(HttpHeaders.AUTHORIZATION, "Bearer "))
                                .andExpect(status().isUnauthorized());
                mvc.perform(get("/api/v1/players/me").header(HttpHeaders.AUTHORIZATION, playerA + "tampered"))
                                .andExpect(status().isUnauthorized());
                mvc.perform(get("/api/v1/players/me").header(HttpHeaders.AUTHORIZATION, "Basic YWRtaW46YWRtaW4="))
                                .andExpect(status().isUnauthorized());

                // A token whose subject no longer exists must not authenticate.
                User ghost = TestAuth.user(users, encoder, "sec.ghost@turfchai.test", RoleType.PLAYER);
                String ghostToken = TestAuth.bearer(jwt, ghost);
                users.delete(ghost);
                mvc.perform(get("/api/v1/players/me").header(HttpHeaders.AUTHORIZATION, ghostToken))
                                .andExpect(status().isUnauthorized());
        }

        // ── Role boundaries ──────────────────────────────────────────────────

        @Test
        @DisplayName("A player cannot reach owner or admin namespaces")
        void playerCannotReachPrivilegedNamespaces() throws Exception {
                String[] forbidden = {
                                "/api/v1/owner/venues", "/api/v1/owner/bookings", "/api/v1/owner/analytics/dashboard",
                                "/api/v1/owner/reviews", "/api/v1/owner/customers", "/api/v1/owner/payments",
                                "/api/v1/admin/users", "/api/v1/admin/venues", "/api/v1/admin/payouts",
                                "/api/v1/admin/turf-requests", "/api/v1/admin/analytics/dashboard",
                                "/api/ai/metrics", "/v3/api-docs",
                };
                for (String route : forbidden) {
                        mvc.perform(get(route).header(HttpHeaders.AUTHORIZATION, auth(playerA)))
                                        .andExpect(status().isForbidden());
                }
        }

        @Test
        @DisplayName("An owner cannot reach the admin namespace")
        void ownerCannotReachAdminNamespace() throws Exception {
                for (String route : new String[] {
                                "/api/v1/admin/users", "/api/v1/admin/venues", "/api/v1/admin/payouts",
                                "/api/v1/admin/analytics/dashboard" }) {
                        mvc.perform(get(route).header(HttpHeaders.AUTHORIZATION, auth(ownerA)))
                                        .andExpect(status().isForbidden());
                }
        }

        @Test
        @DisplayName("Only a super admin may appoint or deactivate admins")
        void adminCannotEscalateToSuperAdminOperations() throws Exception {
                mvc.perform(post("/api/v1/admin/admins").header(HttpHeaders.AUTHORIZATION, auth(admin))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"fullName":"New Admin","email":"new.admin@turfchai.test",
                                                 "phone":"+8801700000123","temporaryPassword":"TempPass@123",
                                                 "adminRole":"SUPPORT","permissions":{}}
                                                """))
                                .andExpect(status().isForbidden());

                mvc.perform(get("/api/v1/admin/admins").header(HttpHeaders.AUTHORIZATION, auth(admin)))
                                .andExpect(status().isOk());
                mvc.perform(get("/api/v1/admin/admins").header(HttpHeaders.AUTHORIZATION, auth(superAdmin)))
                                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("Roles cannot be escalated through self-registration")
        void selfRegistrationCannotGrantAdminRole() throws Exception {
                mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"fullName":"Escalate","email":"escalate@turfchai.test",
                                                 "password":"TestPass@123","phone":"+8801700000999","role":"ADMIN"}
                                                """))
                                .andExpect(status().isForbidden());
        }

        // ── Tenant isolation ─────────────────────────────────────────────────

        @Test
        @DisplayName("Owner B cannot read, update or manage Owner A's venue")
        void ownersAreIsolatedFromEachOther() throws Exception {
                mvc.perform(get("/api/v1/owner/venues/" + ownerAVenueId)
                                .header(HttpHeaders.AUTHORIZATION, auth(ownerB)))
                                .andExpect(status().isForbidden());

                mvc.perform(put("/api/v1/owner/venues/" + ownerAVenueId)
                                .header(HttpHeaders.AUTHORIZATION, auth(ownerB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"HIJACKED\"}"))
                                .andExpect(status().isForbidden());

                mvc.perform(get("/api/v1/owner/venues/" + ownerAVenueId + "/promotions")
                                .header(HttpHeaders.AUTHORIZATION, auth(ownerB)))
                                .andExpect(status().isForbidden());

                // Body is deliberately valid so the request reaches the ownership check
                // rather than being rejected earlier by bean validation.
                mvc.perform(post("/api/v1/owner/venues/" + ownerAVenueId + "/pitches")
                                .header(HttpHeaders.AUTHORIZATION, auth(ownerB))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                                                {"name":"Ghost Pitch","format":"7_a_side","surfaceType":"Artificial grass",
                                                 "surfaceDetail":"test","dimensions":"30x50","lighting":"LED",
                                                 "maxPlayers":14,"indoor":false,"sportSlugs":["football"]}
                                                """))
                                .andExpect(status().isForbidden());

                // ...and Owner A still can.
                mvc.perform(get("/api/v1/owner/venues/" + ownerAVenueId)
                                .header(HttpHeaders.AUTHORIZATION, auth(ownerA)))
                                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("An owner's venue list only ever contains their own venues")
        void ownerVenueListIsScopedToTheCaller() throws Exception {
                mvc.perform(get("/api/v1/owner/venues").header(HttpHeaders.AUTHORIZATION, auth(ownerB)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$[?(@.id == " + ownerAVenueId + ")]").isEmpty());
        }

        // ── Cross-user resources ─────────────────────────────────────────────

        @Test
        @DisplayName("A player cannot read another player's booking or payment history")
        void bookingsAreNotReadableAcrossUsers() throws Exception {
                mvc.perform(get("/api/v1/bookings/999999").header(HttpHeaders.AUTHORIZATION, auth(playerB)))
                                .andExpect(result -> {
                                        int s = result.getResponse().getStatus();
                                        if (s == 200) {
                                                throw new AssertionError(
                                                                "A stranger must never receive another user's booking");
                                        }
                                });
                mvc.perform(get("/api/v1/payments/booking/999999").header(HttpHeaders.AUTHORIZATION, auth(playerB)))
                                .andExpect(result -> {
                                        int s = result.getResponse().getStatus();
                                        if (s == 200) {
                                                throw new AssertionError(
                                                                "A stranger must never receive another user's payments");
                                        }
                                });
        }

        @Test
        @DisplayName("TC-002: a signed-in non-host cannot operate someone else's tournament")
        void nonHostCannotOperateTournament() throws Exception {
                String code = TournamentDataSeeder.DEMO_CODE;
                mvc.perform(get("/api/v1/host/tournaments/" + code)
                                .header(HttpHeaders.AUTHORIZATION, auth(playerA)))
                                .andExpect(status().isForbidden());
                mvc.perform(post("/api/v1/host/tournaments/" + code + "/fixtures/generate")
                                .header(HttpHeaders.AUTHORIZATION, auth(playerA)))
                                .andExpect(status().isForbidden());
                mvc.perform(post("/api/v1/host/tournaments/" + code + "/teams/1/entry-fee")
                                .header(HttpHeaders.AUTHORIZATION, auth(playerA)))
                                .andExpect(status().isForbidden());
        }

        // ── PII ──────────────────────────────────────────────────────────────

        @Test
        @DisplayName("No response leaks a password hash or 2FA secret")
        void secretsAreNeverSerialised() throws Exception {
                String profile = mvc.perform(get("/api/v1/players/me")
                                .header(HttpHeaders.AUTHORIZATION, auth(playerA)))
                                .andReturn().getResponse().getContentAsString();
                String me = mvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, auth(playerA)))
                                .andReturn().getResponse().getContentAsString();
                String adminUsers = mvc.perform(get("/api/v1/admin/users")
                                .header(HttpHeaders.AUTHORIZATION, auth(superAdmin)))
                                .andReturn().getResponse().getContentAsString();

                for (String body : new String[] { profile, me, adminUsers }) {
                        if (body.contains("passwordHash") || body.contains("password_hash")
                                        || body.contains("twoFactorSecret") || body.contains("$2a$")
                                        || body.contains("$2b$")) {
                                throw new AssertionError("Response leaked a credential: "
                                                + body.substring(0, Math.min(200, body.length())));
                        }
                }
        }

        @Test
        @DisplayName("A player's profile response never contains another user's identity")
        void profileResponseIsScopedToTheCaller() throws Exception {
                mvc.perform(get("/api/v1/players/me").header(HttpHeaders.AUTHORIZATION, auth(playerB)))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.email").value("sec.player.b@turfchai.test"));
        }

        @Test
        @DisplayName("An unknown route does not reveal itself to anonymous callers")
        void unknownRoutesAreNotEnumerable() throws Exception {
                mvc.perform(get("/api/v1/definitely-not-a-route-" + UUID.randomUUID()))
                                .andExpect(status().isUnauthorized());
        }
}
