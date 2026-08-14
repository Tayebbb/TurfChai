package com.turfchai.booking.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.event.SlotStatusChangedEvent;
import com.turfchai.booking.repository.SlotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Releases holds that were never confirmed within their 5-minute window.
 * Candidates are found by a cheap scan, then each row is re-locked with
 * PESSIMISTIC_WRITE and the condition is re-checked under the lock before the
 * slot is returned to AVAILABLE — so a concurrent {@link BookingService#confirmBooking}
 * can never be clobbered by this job.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SlotHoldCleanupJob {

    private final SlotRepository slotRepository;
    private final ApplicationEventPublisher events;

    @Scheduled(fixedRate = 30000)
    @Transactional
    public void releaseExpiredHolds() {
        OffsetDateTime now = OffsetDateTime.now();
        List<Slot> candidates = slotRepository.findByStatusAndHoldExpiresAtBefore(SlotStatus.HELD, now);

        for (Slot slot : candidates) {
            Slot locked = slotRepository.findByIdForUpdate(slot.getId()).orElse(null);
            if (locked == null
                    || locked.getStatus() != SlotStatus.HELD
                    || locked.getHoldExpiresAt() == null
                    || !locked.getHoldExpiresAt().isBefore(now)) {
                continue;
            }

            log.info("Releasing expired hold on slot {} (was held until {})",
                    locked.getId(), locked.getHoldExpiresAt());
            locked.setStatus(SlotStatus.AVAILABLE);
            locked.setHeldByUserId(null);
            locked.setHoldExpiresAt(null);
            slotRepository.save(locked);
            events.publishEvent(SlotStatusChangedEvent.of(
                    locked.getId(), locked.getVenueId(), locked.getSlotDate(), SlotStatus.AVAILABLE));
        }
    }
}
