package com.turfchai.controller;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.model.OwnerCustomerNote;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.promotion.entity.Promotion;
import com.turfchai.promotion.repository.PromotionRepository;
import com.turfchai.repository.OwnerCustomerNoteRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.NotificationService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OwnerCustomerRestControllerTest {

    @Mock
    private VenueRepository venueRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private OwnerCustomerNoteRepository ownerCustomerNoteRepository;

    @Mock
    private PromotionRepository promotionRepository;

    @Mock
    private NotificationService notificationService;

    private OwnerCustomerRestController controller;
    private UserPrincipal ownerPrincipal;
    private Venue mockVenue;
    private User customerUser;

    @BeforeEach
    void setUp() {
        controller = new OwnerCustomerRestController(
                venueRepository,
                bookingRepository,
                userRepository,
                ownerCustomerNoteRepository,
                promotionRepository,
                notificationService);

        User owner = User.builder()
                .id(100L)
                .email("owner@turfchai.com")
                .fullName("Owner Test")
                .phone("+8801700000100")
                .role(RoleType.OWNER)
                .build();
        ownerPrincipal = new UserPrincipal(owner);

        mockVenue = new Venue();
        mockVenue.setId(1L);
        mockVenue.setName("Kick Off Arena");
        mockVenue.setOwner(owner);

        customerUser = User.builder()
                .id(200L)
                .email("customer@turfchai.com")
                .fullName("Nabil Ahmed")
                .phone("+8801700000200")
                .role(RoleType.PLAYER)
                .build();
    }

    @Test
    @DisplayName("GET /api/v1/owner/customers returns customer list with note and visit details")
    void testGetOwnerCustomers() {
        when(venueRepository.findByOwnerId(100L)).thenReturn(List.of(mockVenue));

        Booking b1 = new Booking();
        b1.setId(10L);
        b1.setUserId(200L);
        b1.setVenueId(1L);
        b1.setStatus(BookingStatus.CONFIRMED);
        b1.setGrossAmount(new BigDecimal("2500"));
        b1.setBookingDate(LocalDate.now().minusDays(2));
        b1.setStartTime(LocalTime.of(18, 0));

        when(bookingRepository.findByVenueIdIn(List.of(1L))).thenReturn(List.of(b1));
        when(userRepository.findById(200L)).thenReturn(Optional.of(customerUser));
        when(ownerCustomerNoteRepository.findByOwnerId(100L)).thenReturn(List.of(
                OwnerCustomerNote.builder()
                        .ownerId(100L)
                        .customerId(200L)
                        .note("Preferred goalkeeper")
                        .build()));

        ResponseEntity<List<Map<String, Object>>> response = controller.getOwnerCustomers(ownerPrincipal);

        assertEquals(200, response.getStatusCode().value());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());

        Map<String, Object> c = response.getBody().get(0);
        assertEquals("200", c.get("id"));
        assertEquals("Nabil Ahmed", c.get("name"));
        assertEquals("Preferred goalkeeper", c.get("note"));
        assertEquals(1, c.get("confirmedVisits"));
    }

    @Test
    @DisplayName("PUT /api/v1/owner/customers/{customerId}/note saves customer note")
    void testUpdateCustomerNote() {
        when(ownerCustomerNoteRepository.findByOwnerIdAndCustomerId(100L, 200L))
                .thenReturn(Optional.empty());

        ResponseEntity<Map<String, Object>> response = controller.updateCustomerNote(
                ownerPrincipal,
                200L,
                Map.of("note", "VIP captain"));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("VIP captain", response.getBody().get("note"));
        verify(ownerCustomerNoteRepository, times(1)).save(any(OwnerCustomerNote.class));
    }

    @Test
    @DisplayName("POST /api/v1/owner/customers/{customerId}/reward sends 10% coupon")
    void testRewardCustomer() {
        when(venueRepository.findByOwnerId(100L)).thenReturn(List.of(mockVenue));
        when(userRepository.findById(200L)).thenReturn(Optional.of(customerUser));

        Promotion promo = new Promotion();
        promo.setId(5L);
        promo.setCode("LOYAL10");
        promo.setVenue(mockVenue);
        when(promotionRepository.findByVenueIdAndCode(1L, "LOYAL10")).thenReturn(Optional.of(promo));

        ResponseEntity<Map<String, Object>> response = controller.rewardCustomer(ownerPrincipal, 200L);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(true, response.getBody().get("success"));
        assertEquals("LOYAL10", response.getBody().get("code"));

        verify(notificationService, times(1)).send(
                eq(200L),
                eq("PROMOTION"),
                contains("10% Off Loyalty Reward"),
                contains("LOYAL10"),
                eq("/venues/1"));
    }
}
