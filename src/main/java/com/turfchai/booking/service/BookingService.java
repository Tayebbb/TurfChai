package com.turfchai.booking.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.exception.SlotUnavailableException;
import com.turfchai.booking.repository.SlotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
public class BookingService {

    private static final long HOLD_DURATION_MINUTES = 5;

    private final SlotRepository slotRepository;

    /**
     * Acquires a 5-minute hold on a slot. The row is locked with
     * PESSIMISTIC_WRITE so concurrent hold attempts serialize on the DB row.
     * An expired hold left behind by a previous user can be re-acquired.
     */
    @Transactional
    public void holdSlot(Long userId, Long slotId) {
        Slot slot = slotRepository.findByIdForUpdate(slotId)
                .orElseThrow(() -> new SlotUnavailableException("Slot not found with id: " + slotId));

        OffsetDateTime now = OffsetDateTime.now();
        boolean expiredHold = slot.getStatus() == SlotStatus.HELD
                && slot.getHoldExpiresAt() != null
                && slot.getHoldExpiresAt().isBefore(now);

        if (slot.getStatus() == SlotStatus.AVAILABLE || expiredHold) {
            slot.setStatus(SlotStatus.HELD);
            slot.setHeldByUserId(userId);
            slot.setHoldExpiresAt(now.plusMinutes(HOLD_DURATION_MINUTES));
            slotRepository.save(slot);
            return;
        }
        throw new SlotUnavailableException("Slot is not available for booking");
    }
}
