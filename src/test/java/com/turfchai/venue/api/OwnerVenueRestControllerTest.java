package com.turfchai.venue.api;

import com.turfchai.exception.VenueNotFoundException;
import com.turfchai.security.UserPrincipal;
import com.turfchai.venue.dto.owner.VenueManagementDto;
import com.turfchai.venue.service.SlotPricingRuleEngine;
import com.turfchai.venue.service.VenueManagementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OwnerVenueRestControllerTest {

    @Mock
    private VenueManagementService managementService;

    @Mock
    private SlotPricingRuleEngine pricingEngine;

    private OwnerVenueRestController controller;
    private UserPrincipal ownerPrincipal;

    @BeforeEach
    void setUp() {
        controller = new OwnerVenueRestController(managementService, pricingEngine);
        com.turfchai.model.User u = new com.turfchai.model.User();
        u.setId(100L);
        u.setEmail("owner@turfchai.com");
        u.setRole(com.turfchai.model.enums.RoleType.OWNER);
        ownerPrincipal = new UserPrincipal(u);
    }

    @Test
    @DisplayName("GET /api/v1/owner/venues/{id} returns venue DTO for owner")
    void testGetVenue_Success() {
        VenueManagementDto dto = new VenueManagementDto(
                1L, "VEN-0001", "kick-off-arena", "Kick Off Arena", "DRAFT",
                "Dhanmondi 27", "Dhanmondi", null, null,
                null, null, null, null, null, null,
                null, null, null, true, true, false, false, null,
                true, List.of(), List.of(), List.of()
        );

        when(managementService.getOwnerVenue(100L, 1L)).thenReturn(dto);

        VenueManagementDto result = controller.getVenue(ownerPrincipal, 1L);

        assertNotNull(result);
        assertEquals("Kick Off Arena", result.name());
        verify(managementService).getOwnerVenue(100L, 1L);
    }

    @Test
    @DisplayName("GET /api/v1/owner/venues/{id} throws VenueNotFoundException when non-existent")
    void testGetVenue_NotFound() {
        when(managementService.getOwnerVenue(100L, 999L))
                .thenThrow(new VenueNotFoundException("Venue not found: 999"));

        assertThrows(VenueNotFoundException.class, () -> controller.getVenue(ownerPrincipal, 999L));
    }

    @Test
    @DisplayName("PUT /api/v1/owner/venues/{id}/status updates venue status")
    void testUpdateStatus_Success() {
        VenueManagementDto dto = new VenueManagementDto(
                1L, "VEN-0001", "kick-off-arena", "Kick Off Arena", "LIVE",
                "Dhanmondi 27", "Dhanmondi", null, null,
                null, null, null, null, null, null,
                null, null, null, true, true, false, false, null,
                true, List.of(), List.of(), List.of()
        );

        when(managementService.updateVenueStatus(100L, 1L, "LIVE")).thenReturn(dto);

        VenueManagementDto result = controller.updateStatus(ownerPrincipal, 1L, Map.of("status", "LIVE"));

        assertNotNull(result);
        assertEquals("LIVE", result.status());
        verify(managementService).updateVenueStatus(100L, 1L, "LIVE");
    }

    @Test
    @DisplayName("PUT /api/v1/owner/venues/{id}/status rejects empty status with IllegalArgumentException")
    void testUpdateStatus_EmptyStatusRejected() {
        assertThrows(IllegalArgumentException.class, () -> controller.updateStatus(ownerPrincipal, 1L, Map.of("status", "")));
        verifyNoInteractions(managementService);
    }
}
