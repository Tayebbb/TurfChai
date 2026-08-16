package com.turfchai.booking.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.JwtService;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.concurrent.ThreadLocalRandom;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookingRestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private VenueRepository venueRepository;

    @Autowired
    private PitchRepository pitchRepository;

    @Autowired
    private SlotRepository slotRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    private User user;
    private String token;
    /** POST /api/v1/bookings books without payment, so it is staff-only. */
    private String staffToken;

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
                .fullName("Booking Tester")
                .email("booking-" + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .build());
        token = jwtService.generateToken(user);

        User staff = userRepository.save(User.builder()
                .fullName("Booking Staff")
                .email("booking-staff-" + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .role(com.turfchai.model.enums.RoleType.OWNER)
                .build());
        staffToken = jwtService.generateToken(staff);
    }

    @Test
    void holdSlot_requiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":1}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void holdSlot_holdsAvailableSlot() throws Exception {
        Slot slot = freshSlot();
        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slotId").value(slot.getId()))
                .andExpect(jsonPath("$.heldUntil").exists());
    }

    /**
     * A second hold-slot call from the *same* user (e.g. a duplicate request
     * from React StrictMode's double-invoked mount effect, or a retry) must
     * refresh the hold rather than 409 — otherwise checkout fails
     * deterministically every time. See BookingService#holdSlot.
     */
    @Test
    void holdSlot_refreshesOwnActiveHold() throws Exception {
        Slot slot = freshSlot();
        String request = "{\"slotId\":" + slot.getId() + "}";

        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk());
    }

    @Test
    void holdSlot_conflictsWhenAnotherUserHoldsIt() throws Exception {
        Slot slot = freshSlot();
        String request = "{\"slotId\":" + slot.getId() + "}";

        User otherUser = userRepository.save(User.builder()
                .fullName("Other Booking Tester")
                .email("booking-other-" + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .build());
        String otherToken = jwtService.generateToken(otherUser);

        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request))
                .andExpect(status().isConflict());
    }

    @Test
    void createBooking_requiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":1}"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * Confirming without payment used to be open to any signed-in player, which
     * booked the slot for free. Only venue staff may use it.
     */
    @Test
    void createBooking_isRefusedForPlayers() throws Exception {
        Slot slot = freshSlot();
        hold(slot);

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void createBooking_confirmsHeldSlot() throws Exception {
        Slot slot = freshSlot();
        holdAs(slot, staffToken);

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingCode", startsWith("TC-")))
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.slotId").value(slot.getId()));
    }

    @Test
    void createBooking_conflictsWithoutHold() throws Exception {
        Slot slot = freshSlot();
        mockMvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isConflict());
    }

    @Test
    void cancelBooking_requiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bookings/1/cancel"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void cancelBooking_cancelsOwnBooking() throws Exception {
        Slot slot = freshSlot();
        Long bookingId = holdAndCreate(slot);

        mockMvc.perform(post("/api/v1/bookings/" + bookingId + "/cancel")
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isOk());
    }

    @Test
    void cancelBooking_notFoundWhenMissing() throws Exception {
        // Used to answer 409 Conflict, which means "the slot is already taken".
        // A booking that is not there is a 404.
        mockMvc.perform(post("/api/v1/bookings/999999/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void getBooking_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/bookings/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getBooking_returnsOwnBooking() throws Exception {
        Slot slot = freshSlot();
        Long bookingId = holdAndCreate(slot);

        mockMvc.perform(get("/api/v1/bookings/" + bookingId)
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingCode").isNotEmpty())
                .andExpect(jsonPath("$.slotId").value(slot.getId()));
    }

    @Test
    void getBooking_notFoundWhenMissing() throws Exception {
        mockMvc.perform(get("/api/v1/bookings/999999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    /**
     * A booking belonging to someone else must answer exactly as a missing one,
     * or the id space becomes a directory of other people's bookings.
     */
    @Test
    void getBooking_foreignBookingLooksExactlyLikeAMissingOne() throws Exception {
        Slot slot = freshSlot();
        Long bookingId = holdAndCreate(slot);

        mockMvc.perform(get("/api/v1/bookings/" + bookingId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void listBookings_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/bookings"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listBookings_returnsUsersBookings() throws Exception {
        Slot slot = freshSlot();
        holdAndCreate(slot);

        mockMvc.perform(get("/api/v1/bookings")
                        .header("Authorization", "Bearer " + staffToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].bookingCode").exists());
    }

    @Test
    void listBookings_emptyForNewUser() throws Exception {
        mockMvc.perform(get("/api/v1/bookings")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    private Slot freshSlot() {
        Venue venue = venueRepository.save(Venue.builder()
                .slug("venue-" + System.nanoTime())
                .name("Booking Venue")
                .address("Test Address")
                .area("Test Area")
                .build());
        Pitch pitch = new Pitch();
        pitch.setVenue(venue);
        pitch.setName("Pitch B");
        pitch.setMaxPlayers(10);
        pitch.setActive(true);
        pitchRepository.save(pitch);
        return slotRepository.save(Slot.builder()
                .pitch(pitch)
                .venueId(venue.getId())
                // Relative to today, not a fixed date: the booking engine now
                // refuses slots whose start time has passed, so a hardcoded
                // date silently becomes unbookable once it goes by.
                .slotDate(LocalDate.now().plusDays(7))
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 0))
                .price(BigDecimal.valueOf(2550))
                .status(SlotStatus.AVAILABLE)
                .build());
    }

    private void hold(Slot slot) throws Exception {
        holdAs(slot, token);
    }

    private void holdAs(Slot slot, String bearer) throws Exception {
        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .header("Authorization", "Bearer " + bearer)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isOk());
    }

    private Long holdAndCreate(Slot slot) throws Exception {
        holdAs(slot, staffToken);
        MvcResult created = mockMvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + staffToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = objectMapper.readTree(created.getResponse().getContentAsString());
        return node.get("id").asLong();
    }
}
