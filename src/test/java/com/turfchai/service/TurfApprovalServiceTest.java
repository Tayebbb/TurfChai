package com.turfchai.service;

import com.turfchai.model.TurfRequest;
import com.turfchai.repository.TurfRequestRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TurfApprovalServiceTest {

    @Mock
    private TurfRequestRepository turfRequestRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private TurfApprovalService turfApprovalService;

    private TurfRequest pendingRequest;

    @BeforeEach
    void setUp() {
        pendingRequest = new TurfRequest();
        pendingRequest.setRequestCode("TR-1001");
        pendingRequest.setStatus("PENDING");
        pendingRequest.setOwnerUserId(100L);
        pendingRequest.setVenueName("Test Arena");
    }

    @Test
    void testApprove_Success() {
        when(turfRequestRepository.findByRequestCode("TR-1001")).thenReturn(Optional.of(pendingRequest));

        turfApprovalService.review("TR-1001", "APPROVE", "Looks good", 1L);

        assertEquals("APPROVED", pendingRequest.getStatus());
        assertEquals("Looks good", pendingRequest.getAdminNote());
        assertEquals(1L, pendingRequest.getReviewedBy());
        assertNotNull(pendingRequest.getReviewedAt());

        verify(turfRequestRepository, times(1)).save(pendingRequest);
        verify(notificationService, times(1)).send(eq(100L), eq("TURF_REQUEST"), anyString(), anyString(), anyString());
    }

    @Test
    void testApprove_FailsWhenAlreadyApproved() {
        pendingRequest.setStatus("APPROVED");
        when(turfRequestRepository.findByRequestCode("TR-1001")).thenReturn(Optional.of(pendingRequest));

        assertThrows(IllegalStateException.class, () -> turfApprovalService.review("TR-1001", "APPROVE", null, 1L));
        verify(turfRequestRepository, never()).save(any());
    }

    @Test
    void testRequestChanges_Success() {
        when(turfRequestRepository.findByRequestCode("TR-1001")).thenReturn(Optional.of(pendingRequest));

        turfApprovalService.review("TR-1001", "REQUEST_CHANGES", "Update NID", 1L);

        assertEquals("CHANGES_REQUESTED", pendingRequest.getStatus());
        assertEquals("Update NID", pendingRequest.getAdminNote());

        verify(turfRequestRepository, times(1)).save(pendingRequest);
    }
}
