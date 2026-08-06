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

    @BeforeEach
    void setUp() {
        user = userRepository.save(User.builder()
                .fullName("Booking Tester")
                .email("booking-" + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .build());
        token = jwtService.generateToken(user);
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

    @Test
    void holdSlot_conflictsOnActiveHold() throws Exception {
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
                .andExpect(status().isConflict());
    }

    @Test
    void createBooking_requiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/bookings")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":1}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createBooking_confirmsHeldSlot() throws Exception {
        Slot slot = freshSlot();
        hold(slot);

        mockMvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + token)
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
                        .header("Authorization", "Bearer " + token)
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
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void cancelBooking_conflictsWhenNotFound() throws Exception {
        mockMvc.perform(post("/api/v1/bookings/999999/cancel")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
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
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookingCode").isNotEmpty())
                .andExpect(jsonPath("$.slotId").value(slot.getId()));
    }

    @Test
    void getBooking_conflictsWhenNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/bookings/999999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
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
                        .header("Authorization", "Bearer " + token))
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
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(11, 0))
                .status(SlotStatus.AVAILABLE)
                .build());
    }

    private void hold(Slot slot) throws Exception {
        mockMvc.perform(post("/api/v1/bookings/hold-slot")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isOk());
    }

    private Long holdAndCreate(Slot slot) throws Exception {
        hold(slot);
        MvcResult created = mockMvc.perform(post("/api/v1/bookings")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"slotId\":" + slot.getId() + "}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = objectMapper.readTree(created.getResponse().getContentAsString());
        return node.get("id").asLong();
    }
}
