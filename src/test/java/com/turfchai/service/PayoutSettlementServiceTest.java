package com.turfchai.service;

import com.turfchai.model.Payout;
import com.turfchai.repository.PayoutRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PayoutSettlementServiceTest {

    @Mock
    private PayoutRepository payoutRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private PayoutSettlementService payoutSettlementService;

    private Payout pendingPayout;

    @BeforeEach
    void setUp() {
        pendingPayout = new Payout();
        pendingPayout.setPayoutCode("PO-1001");
        pendingPayout.setStatus("PENDING");
        pendingPayout.setGrossAmount(new BigDecimal("1000.00"));
        pendingPayout.setPlatformFee(BigDecimal.ZERO);
        pendingPayout.setOwnerUserId(200L);
    }

    @Test
    void testSettle_SuccessWithFeeCalculation() {
        when(payoutRepository.findByPayoutCode("PO-1001")).thenReturn(Optional.of(pendingPayout));

        payoutSettlementService.settle("PO-1001", 1L);

        assertEquals("SETTLED", pendingPayout.getStatus());
        assertEquals(0, new BigDecimal("60.00").compareTo(pendingPayout.getPlatformFee()));
        assertEquals(0, new BigDecimal("940.00").compareTo(pendingPayout.getNetAmount()));
        assertEquals(1L, pendingPayout.getSettledBy());
        assertNotNull(pendingPayout.getSettledAt());

        verify(payoutRepository, times(1)).save(pendingPayout);
        verify(notificationService, times(1)).send(eq(200L), eq("PAYMENT"), anyString(), anyString(), anyString());
    }

    @Test
    void testSettle_FailsOnFlagged() {
        pendingPayout.setAnomalyFlag(true);
        when(payoutRepository.findByPayoutCode("PO-1001")).thenReturn(Optional.of(pendingPayout));

        assertThrows(IllegalStateException.class, () -> payoutSettlementService.settle("PO-1001", 1L));
        verify(payoutRepository, never()).save(any());
    }

    @Test
    void testFlag_Success() {
        when(payoutRepository.findByPayoutCode("PO-1001")).thenReturn(Optional.of(pendingPayout));

        payoutSettlementService.flag("PO-1001", "Suspicious activity", 1L);

        assertEquals("FLAGGED", pendingPayout.getStatus());
        assertTrue(pendingPayout.getAnomalyFlag());
        assertEquals("Suspicious activity", pendingPayout.getAnomalyReason());

        verify(payoutRepository, times(1)).save(pendingPayout);
        verify(notificationService, times(1)).send(eq(200L), eq("SYSTEM"), anyString(), anyString(), anyString());
    }
}
