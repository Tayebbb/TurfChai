package com.turfchai.ai.tool.impl;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolRegistry;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.service.SlotAvailabilityService;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The assistant's tools must answer from the same database the REST API
 * serves, and must scope personal data to the verified principal.
 *
 * <p>
 * These two properties are what separate this from the fixture-backed tools
 * that shipped before: those returned five invented venues and an in-memory
 * booking map, so the chat window quoted prices for turfs that did not exist.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
class AiToolLiveDataTest {

    private static final Set<String> EXPECTED_TOOLS = Set.of(
            "search_venues", "manage_booking", "get_user_profile",
            "get_payment_status", "search_tournaments", "update_booking_context");

    @Autowired
    private ToolRegistry registry;
    /** The very bean {@code bookingAssistantAgent} is constructed with. */
    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper toolObjectMapper;
    @Autowired
    private VenueRepository venues;
    @Autowired
    private BookingRepository bookings;
    @Autowired
    private UserRepository users;
    @Autowired
    private PasswordEncoder encoder;
    @Autowired
    private SlotAvailabilityService slotAvailabilityService;

    private User owner;
    private User outsider;
    private Venue venue;

    @BeforeEach
    void setUp() {
        // Distinct names on purpose: TestAuth calls every PLAYER "Test PLAYER",
        // which would make the impersonation assertion below pass vacuously.
        owner = player("Owner Of The Booking");
        outsider = player("Somebody Else Entirely");
        // Picked by the capacity the test actually needs. Reading venue.pitches
        // here instead would touch a lazy collection outside a transaction.
        LocalDate probe = LocalDate.now().plusDays(1);
        venue = venues.findAll().stream()
                .filter(v -> !slotAvailabilityService.ensureSlots(v.getId(), probe).isEmpty())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No venue publishes slots, so this test would prove nothing"));
    }

    private User player(String fullName) {
        long unique = System.nanoTime();
        return users.save(User.builder()
                .publicId(java.util.UUID.randomUUID().toString())
                .fullName(fullName)
                .email("ai.tool." + unique + "@turfchai.test")
                .phone("+8801" + (unique % 1_000_000_000L))
                .passwordHash(encoder.encode("TestPass@123"))
                .role(RoleType.PLAYER)
                .status("ACTIVE")
                .build());
    }

    private ToolResult run(String tool, Map<String, Object> args, ToolContext context) {
        return registry.execute(tool, args, context);
    }

    private ToolContext as(User user) {
        return new ToolContext("session-" + user.getId(), "user:" + user.getId(), user.getId());
    }

    private ToolContext anonymous() {
        return new ToolContext("anon-session", "visitor-1");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> body(ToolResult result) {
        assertThat(result.success()).as("tool failed: %s", result.error()).isTrue();
        return (Map<String, Object>) result.data();
    }

    // ── the tool set itself ──────────────────────────────────────────────

    @Test
    @DisplayName("every registered tool is one of the live-data implementations")
    void registryExposesOnlyLiveTools() {
        assertThat(registry.specs()).extracting(ToolSpec::name)
                .containsExactlyInAnyOrderElementsOf(EXPECTED_TOOLS);
    }

    // ── public reads come from the catalogue ─────────────────────────────

    @Test
    @DisplayName("search_venues returns venues that exist in the database")
    void venueSearchIsBackedByTheCatalogue() {
        Map<String, Object> result = body(run("search_venues", Map.of("limit", 5), anonymous()));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("venues");
        assertThat(rows).isNotEmpty();
        for (Map<String, Object> row : rows) {
            String slug = String.valueOf(row.get("slug"));
            assertThat(venues.findBySlug(slug))
                    .as("venue '%s' quoted by the assistant must exist", slug)
                    .isPresent();
        }
    }

    @Test
    @DisplayName("check_availability lists this venue's real slots at their real prices")
    void availabilityIsBackedBySlots() {
        LocalDate date = LocalDate.now().plusDays(1);
        List<Slot> stored = slotAvailabilityService.ensureSlots(venue.getId(), date);

        Map<String, Object> result = body(run("manage_booking",
                Map.of("action", "check_availability", "venue", venue.getSlug(), "date", date.toString()),
                anonymous()));

        assertThat(result.get("venue")).isEqualTo(venue.getName());
        assertThat(result.get("slotsPublished")).isEqualTo(stored.size());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("availableSlots");
        for (Map<String, Object> row : rows) {
            Long slotId = ((Number) row.get("slotId")).longValue();
            Slot slot = stored.stream().filter(s -> s.getId().equals(slotId)).findFirst().orElseThrow();
            assertThat(row.get("priceBdt")).isEqualTo(slot.getPrice());
        }
    }

    @Test
    @DisplayName("an unknown venue is refused rather than answered with a guess")
    void unknownVenueIsRefused() {
        ToolResult result = run("manage_booking",
                Map.of("action", "check_availability", "venue", "no-such-venue", "date",
                        LocalDate.now().plusDays(1).toString()),
                anonymous());

        assertThat(result.success()).isFalse();
        assertThat(result.error()).contains("No venue matches");
    }

    // ── personal data needs a verified principal ─────────────────────────

    @Test
    @DisplayName("an anonymous session cannot read bookings, payments or a profile")
    void anonymousCallersGetNothingPersonal() {
        assertThat(run("manage_booking", Map.of("action", "list"), anonymous()).success()).isFalse();
        assertThat(run("get_user_profile", Map.of(), anonymous()).success()).isFalse();
        assertThat(run("get_payment_status", Map.of("bookingCode", "TC-000001"), anonymous()).success()).isFalse();
    }

    @Test
    @DisplayName("the session label cannot stand in for the verified identity")
    void sessionLabelCannotImpersonateAnotherUser() {
        // The chat endpoint is public, so `userId` is attacker-controlled. Naming
        // the victim in it must not change whose row is read.
        ToolContext spoofed = new ToolContext("s", "user:" + owner.getId(), outsider.getId());

        Map<String, Object> profile = body(run("get_user_profile", Map.of(), spoofed));

        assertThat(profile.get("fullName")).isEqualTo(outsider.getFullName());
        assertThat(profile.get("fullName")).isNotEqualTo(owner.getFullName());
    }

    @Test
    @DisplayName("a booking is readable by its owner and invisible to everybody else")
    void bookingLookupIsScopedToTheOwner() {
        Booking booking = persistBookingFor(owner);

        Map<String, Object> mine = body(run("manage_booking",
                Map.of("action", "get", "bookingCode", booking.getBookingCode()), as(owner)));
        assertThat(mine.get("venue")).isEqualTo(venue.getName());
        assertThat(mine.get("amountBdt")).isEqualTo(booking.getGrossAmount());

        ToolResult theirs = run("manage_booking",
                Map.of("action", "get", "bookingCode", booking.getBookingCode()), as(outsider));
        assertThat(theirs.success()).isFalse();
        assertThat(theirs.error()).isEqualTo("No booking found with code " + booking.getBookingCode());
    }

    @Test
    @DisplayName("a signed-in user's own bookings come back from the database")
    void listReturnsTheCallersBookings() {
        Booking booking = persistBookingFor(owner);

        Map<String, Object> result = body(run("manage_booking", Map.of("action", "list"), as(owner)));

        assertThat(result.get("count")).isEqualTo(1);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) result.get("bookings");
        assertThat(rows).singleElement()
                .satisfies(row -> {
                    assertThat(row.get("bookingCode")).isEqualTo(booking.getBookingCode());
                    assertThat(row.get("venue")).isEqualTo(venue.getName());
                });
    }

    @Test
    @DisplayName("a venue named the way a person would type it still resolves")
    void venueIsResolvableByNameNotJustSlug() {
        // The model relays whatever the user said. Accepting only the slug made
        // "check availability at Tejgaon Kick Zone" a dead end.
        Map<String, Object> result = body(run("manage_booking",
                Map.of("action", "check_availability", "venue", venue.getName(),
                        "date", LocalDate.now().plusDays(1).toString()),
                anonymous()));

        assertThat(result.get("venue")).isEqualTo(venue.getName());
    }

    @Test
    @DisplayName("the payment ledger of another user's booking is not readable")
    void paymentLookupIsScopedToTheOwner() {
        Booking booking = persistBookingFor(owner);

        assertThat(body(run("get_payment_status",
                Map.of("bookingCode", booking.getBookingCode()), as(owner))).get("bookingCode"))
                .isEqualTo(booking.getBookingCode());

        assertThat(run("get_payment_status",
                Map.of("bookingCode", booking.getBookingCode()), as(outsider)).success()).isFalse();
    }

    @Test
    @DisplayName("the assistant refuses to book or cancel rather than pretending it did")
    void writeActionsAreRefused() {
        ToolResult created = run("manage_booking",
                Map.of("action", "create", "venue", venue.getSlug(), "date", LocalDate.now().plusDays(1).toString()),
                as(owner));

        assertThat(created.success()).isFalse();
        assertThat(created.error()).contains("cannot create a booking");
        assertThat(bookings.findByUserId(owner.getId()))
                .as("a refused create must write nothing")
                .noneMatch(b -> b.getBookingDate().equals(LocalDate.now().plusDays(1)));
    }

    // ── fixture ──────────────────────────────────────────────────────────

    private Booking persistBookingFor(User user) {
        LocalDate date = LocalDate.now().plusDays(2);
        Slot slot = slotAvailabilityService.ensureSlots(venue.getId(), date).stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Venue published no slots, so this test proves nothing"));

        return bookings.save(Booking.builder()
                .bookingCode("TC-" + (System.nanoTime() % 100_000_000L))
                .slot(slot)
                .userId(user.getId())
                .venueId(venue.getId())
                .pitchId(slot.getPitch().getId())
                .bookingDate(slot.getSlotDate())
                .startTime(slot.getStartTime())
                .endTime(slot.getEndTime())
                .grossAmount(slot.getPrice())
                .netAmount(slot.getPrice())
                .status(BookingStatus.CONFIRMED)
                .build());
    }

    /** Guards against a future tool being registered without a spec. */
    @Test
    void everyToolDeclaresASpec() {
        for (String name : EXPECTED_TOOLS) {
            Tool tool = registry.find(name).orElseThrow();
            assertThat(tool.spec().name()).isEqualTo(name);
            assertThat(tool.spec().description()).isNotBlank();
        }
    }

    @Test
    @DisplayName("every tool result survives the trip to the model as JSON")
    void toolResultsAreSerialisable() throws Exception {
        // The model never sees a ToolResult, only its JSON. Asserting on the
        // object hid a mapper that could not write LocalDate/LocalTime, so
        // every dated result reached the model as "internal serialization
        // error" and the assistant denied holding data it had just read.
        Booking booking = persistBookingFor(owner);
        LocalDate date = LocalDate.now().plusDays(1);

        List<ToolResult> results = List.of(
                run("search_venues", Map.of("limit", 3), anonymous()),
                run("manage_booking", Map.of("action", "check_availability",
                        "venue", venue.getSlug(), "date", date.toString()), anonymous()),
                run("manage_booking", Map.of("action", "list"), as(owner)),
                run("manage_booking", Map.of("action", "get",
                        "bookingCode", booking.getBookingCode()), as(owner)),
                run("manage_booking", Map.of("action", "cancel_quote",
                        "bookingCode", booking.getBookingCode()), as(owner)),
                run("get_user_profile", Map.of(), as(owner)),
                run("get_payment_status", Map.of("bookingCode", booking.getBookingCode()), as(owner)),
                run("search_tournaments", Map.of(), as(owner)),
                run("update_booking_context", Map.of("sport", "football"), as(owner)));

        for (ToolResult result : results) {
            assertThat(result.success()).as("tool failed: %s", result.error()).isTrue();
            String json = toolObjectMapper.writeValueAsString(result);
            assertThat(json).doesNotContain("serialization error");
        }
    }

    @Test
    @DisplayName("dates reach the model as ISO strings, not epoch arrays")
    void datesSerialiseAsIsoStrings() throws Exception {
        LocalDate date = LocalDate.now().plusDays(1);

        ToolResult result = run("manage_booking", Map.of("action", "check_availability",
                "venue", venue.getSlug(), "date", date.toString()), anonymous());

        String json = toolObjectMapper.writeValueAsString(result);
        assertThat(json).contains("\"date\":\"" + date + "\"");
    }
}
