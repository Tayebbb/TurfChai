package com.turfchai.api;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.testsupport.TestAuth;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
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
import java.time.LocalDate;
import java.time.LocalTime;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression coverage for the reliability defects fixed in the backend audit:
 * TC-005, TC-009, TC-015, TC-017, TC-024, TC-025, TC-028 and the booking
 * state-transition guards.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:api-contract-test;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"
})
class ApiContractRegressionTest {

    @Autowired
    private MockMvc mvc;
    @Autowired
    private UserRepository users;
    @Autowired
    private PasswordEncoder encoder;
    @Autowired
    private JwtService jwt;
    @Autowired
    private VenueRepository venues;
    @Autowired
    private PitchRepository pitches;
    @Autowired
    private SlotRepository slots;
    @Autowired
    private BookingRepository bookings;

    private String playerToken;
    private String adminToken;
    private Long venueId;
    private Long playerId;

    @BeforeEach
    void setUp() {
        User player = TestAuth.user(users, encoder, "contract.player@turfchai.test", RoleType.PLAYER);
        User admin = TestAuth.user(users, encoder, "contract.admin@turfchai.test", RoleType.ADMIN);
        playerToken = TestAuth.bearer(jwt, player);
        adminToken = TestAuth.bearer(jwt, admin);
        playerId = player.getId();

        Venue venue = venues.save(Venue.builder()
                .slug("contract-venue-" + System.nanoTime())
                .name("Contract Venue")
                .address("Addr")
                .area("Dhanmondi")
                .build());
        venueId = venue.getId();

        Pitch pitch = new Pitch();
        pitch.setVenue(venue);
        pitch.setName("Pitch 1");
        pitch.setMaxPlayers(10);
        pitch.setActive(true);
        pitches.save(pitch);
    }

    private Slot slotAt(LocalDate date, LocalTime start) {
        return slots.save(Slot.builder()
                .pitch(pitches.findByVenueId(venueId).get(0))
                .venueId(venueId)
                .slotDate(date)
                .startTime(start)
                .endTime(start.plusMinutes(90))
                .price(BigDecimal.valueOf(2000))
                .status(SlotStatus.AVAILABLE)
                .build());
    }

    // ── TC-025 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-025: slots for an unknown venue are 404, not an empty 200")
    void unknownVenueSlotsAre404() throws Exception {
        mvc.perform(get("/api/v1/venues/99999999/slots").param("date", LocalDate.now().plusDays(1).toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("A known venue still returns its slots")
    void knownVenueStillReturnsSlots() throws Exception {
        mvc.perform(get("/api/v1/venues/" + venueId + "/slots")
                        .param("date", LocalDate.now().plusDays(1).toString()))
                .andExpect(status().isOk());
    }

    // ── TC-009 / QA-N07 ─────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-009: a slot that has already started cannot be held")
    void elapsedSlotCannotBeHeld() throws Exception {
        Slot past = slotAt(LocalDate.now().minusDays(1), LocalTime.of(10, 0));
        mvc.perform(post("/api/v1/bookings/hold-slot")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + past.getId() + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("already started")));
    }

    @Test
    @DisplayName("TC-009: an elapsed slot is reported as not bookable")
    void elapsedSlotIsReportedUnbookable() throws Exception {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        slotAt(yesterday, LocalTime.of(10, 0));
        mvc.perform(get("/api/v1/venues/" + venueId + "/slots").param("date", yesterday.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("AVAILABLE"))
                .andExpect(jsonPath("$[0].bookable").value(false));
    }

    @Test
    @DisplayName("TC-009: a future slot is bookable and can be held")
    void futureSlotIsBookable() throws Exception {
        Slot future = slotAt(LocalDate.now().plusDays(3), LocalTime.of(10, 0));
        mvc.perform(get("/api/v1/venues/" + venueId + "/slots")
                        .param("date", LocalDate.now().plusDays(3).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].bookable").value(true));

        mvc.perform(post("/api/v1/bookings/hold-slot")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + future.getId() + "}"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("QA-N07: a far-past date materialises no slot rows")
    void farPastDateGeneratesNothing() throws Exception {
        mvc.perform(get("/api/v1/venues/" + venueId + "/slots").param("date", "1999-01-01"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("QA-N07: a date beyond the generation horizon materialises no slot rows")
    void beyondHorizonGeneratesNothing() throws Exception {
        String farFuture = LocalDate.now().plusYears(5).toString();
        mvc.perform(get("/api/v1/venues/" + venueId + "/slots").param("date", farFuture))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    // ── TC-028 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-028: a player's booking list carries no owner-view fields")
    void playerBookingsCarryNoOwnerFields() throws Exception {
        mvc.perform(get("/api/v1/bookings").header(HttpHeaders.AUTHORIZATION, playerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].customer").doesNotExist())
                .andExpect(jsonPath("$[*].sub").doesNotExist())
                .andExpect(jsonPath("$[*].subNum").doesNotExist())
                .andExpect(jsonPath("$[*].source").doesNotExist())
                .andExpect(jsonPath("$[*].amountFormatted").doesNotExist())
                .andExpect(jsonPath("$[*].payment").doesNotExist())
                .andExpect(jsonPath("$[*].actions").doesNotExist())
                .andExpect(jsonPath("$[*].dim").doesNotExist());
    }

    // ── TC-017 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-017: a pricing quote with no body fields is 400, not an empty 500")
    void pricingRejectsEmptyPayload() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("TC-017: a missing bookingDateTime is reported as a validation error")
    void pricingRejectsMissingDateTime() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"venueId\":" + venueId + ",\"daysBeforeBooking\":2,\"occupancyRate\":0.5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.validationErrors.bookingDateTime").exists());
    }

    @Test
    @DisplayName("TC-017: a negative daysBeforeBooking is rejected")
    void pricingRejectsNegativeLeadTime() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"venueId\":" + venueId + ",\"bookingDateTime\":\"2026-09-01T19:00:00\","
                                + "\"daysBeforeBooking\":-5,\"occupancyRate\":0.5}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC-017: an out-of-range occupancyRate is rejected")
    void pricingRejectsOutOfRangeOccupancy() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"venueId\":" + venueId + ",\"bookingDateTime\":\"2026-09-01T19:00:00\","
                                + "\"daysBeforeBooking\":2,\"occupancyRate\":7.5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("occupancyRate")));
    }

    @Test
    @DisplayName("TC-017: an unknown venue in a pricing quote is 404, not 500")
    void pricingUnknownVenueIsNotFound() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"venueId\":99999999,\"bookingDateTime\":\"2026-09-01T19:00:00\","
                                + "\"daysBeforeBooking\":2,\"occupancyRate\":0.5}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC-017: malformed JSON is a 400, never a 500")
    void pricingRejectsMalformedJson() throws Exception {
        mvc.perform(post("/api/v1/pricing/quote")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"venueId\": }"))
                .andExpect(status().isBadRequest());
    }

    // ── TC-015 ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("TC-015: an unknown turf-request code is 404, not 400")
    void unknownTurfRequestCodeIs404() throws Exception {
        mvc.perform(get("/api/v1/admin/turf-requests/BOGUS-CODE")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    // ── TC-024 / error envelope ─────────────────────────────────────────────

    @Test
    @DisplayName("TC-024: an authenticated call to an unrouted path is 404 with the standard envelope")
    void unroutedPathIsNotFoundForAuthenticatedCallers() throws Exception {
        mvc.perform(get("/api/v1/definitely-not-a-real-endpoint")
                        .header(HttpHeaders.AUTHORIZATION, playerToken))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("Anonymous rejections carry a JSON body, not an empty response")
    void anonymousRejectionHasABody() throws Exception {
        mvc.perform(get("/api/v1/bookings"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").exists())
                .andExpect(jsonPath("$.message").exists())
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("A wrong-role rejection carries the same envelope")
    void forbiddenRejectionHasABody() throws Exception {
        mvc.perform(get("/api/v1/admin/turf-requests")
                        .header(HttpHeaders.AUTHORIZATION, playerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("An unparseable path variable is 400, not 500")
    void badPathVariableIsBadRequest() throws Exception {
        mvc.perform(get("/api/v1/bookings/not-a-number")
                        .header(HttpHeaders.AUTHORIZATION, playerToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    @DisplayName("A missing required query parameter is 400, not 500")
    void missingQueryParamIsBadRequest() throws Exception {
        mvc.perform(get("/api/v1/venues/" + venueId + "/slots"))
                .andExpect(status().isBadRequest());
    }

    // ── Entity serialisation (TC-005 class) ─────────────────────────────────

    /**
     * Every admin read is exercised end to end. These endpoints project
     * entities into DTOs, and a projection that touches a lazy association
     * after the session closes fails at serialisation time — which is how
     * TC-005 presented. Only a real request catches it.
     */
    @Test
    @DisplayName("Admin listing endpoints serialise without touching a detached proxy")
    void adminListingsSerialiseCleanly() throws Exception {
        for (String path : new String[] {
                "/api/v1/admin/users",
                "/api/v1/admin/venues",
                "/api/v1/admin/payouts",
                "/api/v1/admin/turf-requests",
                "/api/v1/admin/audit-log",
                "/api/v1/admin/holidays" }) {
            mvc.perform(get(path).header(HttpHeaders.AUTHORIZATION, adminToken))
                    .andExpect(status().isOk());
        }
    }

    @Test
    @DisplayName("A single admin venue serialises without the lazy owner blowing up")
    void adminVenueDetailSerialisesCleanly() throws Exception {
        mvc.perform(get("/api/v1/admin/venues/" + venueId).header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(venueId))
                .andExpect(jsonPath("$.data.pitches").doesNotExist())
                .andExpect(jsonPath("$.data.pricingRules").doesNotExist());
    }

    @Test
    @DisplayName("Admin user listings never carry credential fields")
    void adminUsersCarryNoSecrets() throws Exception {
        mvc.perform(get("/api/v1/admin/users").header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[*].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.data[*].twoFactorSecret").doesNotExist())
                .andExpect(jsonPath("$.data[*].failedLoginCount").doesNotExist())
                .andExpect(jsonPath("$.data[*].lockedUntil").doesNotExist());
    }

    @Test
    @DisplayName("An unknown admin venue id is 404, not 400")
    void unknownAdminVenueIs404() throws Exception {
        mvc.perform(get("/api/v1/admin/venues/99999999").header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isNotFound());
    }

    // ── TC-005 ──────────────────────────────────────────────────────────────

    /**
     * TC-005 failed at serialisation, after the transaction committed, so no
     * unit test could see it: the controller returned the {@code Review}
     * entity and Jackson walked Review → Booking → Slot into a detached proxy.
     * Only a real HTTP round trip proves the response is a flat projection.
     */
    @Test
    @DisplayName("TC-005: submitting a review returns 200 and a flat projection, not an entity graph")
    void reviewSubmissionSerialisesAsADto() throws Exception {
        Slot played = slotAt(LocalDate.now().minusDays(2), LocalTime.of(10, 0));
        played.setStatus(SlotStatus.BOOKED);
        slots.save(played);

        Booking booking = bookings.save(Booking.builder()
                .bookingCode("TC-REV" + System.nanoTime() % 100000)
                .slot(played)
                .userId(playerId)
                .status(BookingStatus.CONFIRMED)
                .venueId(venueId)
                .pitchId(played.getPitch().getId())
                .bookingDate(played.getSlotDate())
                .startTime(played.getStartTime())
                .endTime(played.getEndTime())
                .grossAmount(BigDecimal.valueOf(2000))
                .netAmount(BigDecimal.valueOf(2000))
                .build());

        mvc.perform(post("/api/v1/reviews")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingId\":" + booking.getId() + ",\"venueId\":" + venueId
                                + ",\"overallRating\":5,\"comment\":\"Serialisation check\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.bookingId").value(booking.getId()))
                .andExpect(jsonPath("$.data.overallRating").value(5))
                // The entity graph must not be reachable from the response.
                .andExpect(jsonPath("$.data.booking").doesNotExist())
                .andExpect(jsonPath("$.data.slot").doesNotExist())
                .andExpect(jsonPath("$.data.user").doesNotExist())
                .andExpect(jsonPath("$.data.venue").doesNotExist());
    }

    @Test
    @DisplayName("TC-007: a second player cannot review someone else's booking")
    void foreignBookingReviewIsForbidden() throws Exception {
        Slot played = slotAt(LocalDate.now().minusDays(3), LocalTime.of(10, 0));
        played.setStatus(SlotStatus.BOOKED);
        slots.save(played);

        Booking booking = bookings.save(Booking.builder()
                .bookingCode("TC-FOR" + System.nanoTime() % 100000)
                .slot(played)
                .userId(playerId)
                .status(BookingStatus.CONFIRMED)
                .venueId(venueId)
                .pitchId(played.getPitch().getId())
                .bookingDate(played.getSlotDate())
                .startTime(played.getStartTime())
                .endTime(played.getEndTime())
                .grossAmount(BigDecimal.valueOf(2000))
                .netAmount(BigDecimal.valueOf(2000))
                .build());

        mvc.perform(post("/api/v1/reviews")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bookingId\":" + booking.getId() + ",\"venueId\":" + venueId
                                + ",\"overallRating\":1,\"comment\":\"Forged\"}"))
                .andExpect(status().isForbidden());
    }

    // ── Phase 6: controls that used to be toast-only ────────────────────────

    @Test
    @DisplayName("Public venue reviews are paged and never leak author identifiers")
    void publicVenueReviewsArePagedAndAnonymous() throws Exception {
        String slug = venues.findById(venueId).orElseThrow().getSlug();

        mvc.perform(get("/api/v1/venues/" + slug + "/reviews").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(5))
                .andExpect(jsonPath("$.hasMore").exists())
                .andExpect(jsonPath("$.items[*].userId").doesNotExist())
                .andExpect(jsonPath("$.items[*].bookingId").doesNotExist());
    }

    @Test
    @DisplayName("Public venue reviews for an unknown venue are 404")
    void publicVenueReviewsUnknownVenueIs404() throws Exception {
        mvc.perform(get("/api/v1/venues/no-such-venue-anywhere/reviews"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("A player cannot publish an owner response to a review")
    void ownerReviewResponseRejectsPlayers() throws Exception {
        mvc.perform(post("/api/v1/owner/reviews/1/response")
                        .header(HttpHeaders.AUTHORIZATION, playerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"response\":\"Thanks!\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("An empty owner response is rejected before anything is stored")
    void ownerReviewResponseRejectsBlankBody() throws Exception {
        mvc.perform(post("/api/v1/owner/reviews/1/response")
                        .header(HttpHeaders.AUTHORIZATION, adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"response\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("The removed close-shift mock no longer answers 200")
    void closeShiftMockIsGone() throws Exception {
        mvc.perform(post("/api/v1/owner/payments/close-shift")
                        .header(HttpHeaders.AUTHORIZATION, adminToken))
                .andExpect(status().isNotFound());
    }
}
