package com.turfchai.booking.service;

import com.turfchai.booking.dto.request.SlotGenerationRequest;
import com.turfchai.booking.dto.request.UpdateSlotRequest;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.repository.PitchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SlotManagementService {

    private final SlotRepository slotRepository;
    private final PitchRepository pitchRepository;

    @Transactional
    public List<Slot> generateSlots(Long ownerId, SlotGenerationRequest req) {
        Pitch pitch = pitchRepository.findById(req.getPitchId())
                .orElseThrow(() -> new IllegalArgumentException("Pitch not found with id: " + req.getPitchId()));

        if (!pitch.getVenue().getOwner().getId().equals(ownerId)) {
            throw new AccessDeniedException("You do not have permission to generate slots for this pitch");
        }

        List<Slot> generatedSlots = new ArrayList<>();
        LocalDate currentDate = req.getStartDate();
        
        while (!currentDate.isAfter(req.getEndDate())) {
            LocalTime currentTime = req.getStartTime();
            
            while (currentTime.isBefore(req.getEndTime())) {
                LocalTime slotEndTime = currentTime.plusMinutes(req.getSlotDurationMinutes());
                // Handle midnight wrap or end time exceedance
                if (slotEndTime.isAfter(req.getEndTime()) || slotEndTime.isBefore(currentTime)) {
                    break; 
                }

                boolean exists = slotRepository.existsByPitchIdAndSlotDateAndStartTime(pitch.getId(), currentDate, currentTime);
                if (!exists) {
                    Slot slot = Slot.builder()
                            .pitch(pitch)
                            .venueId(pitch.getVenue().getId())
                            .slotDate(currentDate)
                            .startTime(currentTime)
                            .endTime(slotEndTime)
                            .price(req.getBasePrice())
                            .status(SlotStatus.AVAILABLE)
                            .build();
                    generatedSlots.add(slot);
                }
                currentTime = slotEndTime.plusMinutes(Math.max(0, req.getBufferMinutes()));
            }
            currentDate = currentDate.plusDays(1);
        }

        return slotRepository.saveAll(generatedSlots);
    }

    @Transactional
    public Slot updateSlot(Long ownerId, Long slotId, UpdateSlotRequest req) {
        Slot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new IllegalArgumentException("Slot not found with id: " + slotId));

        if (!slot.getPitch().getVenue().getOwner().getId().equals(ownerId)) {
            throw new AccessDeniedException("You do not have permission to modify this slot");
        }

        if (req.getPrice() != null) {
            slot.setPrice(req.getPrice());
        }
        if (req.getStatus() != null) {
            slot.setStatus(req.getStatus());
        }

        return slotRepository.save(slot);
    }

    @Transactional(readOnly = true)
    public List<Slot> getOwnerSlots(Long ownerId, Long venueId, LocalDate startDate, LocalDate endDate) {
        // Just verify owner owns the venue
        List<Slot> slots = slotRepository.findByVenueIdAndSlotDateBetweenOrderBySlotDateAscStartTimeAsc(venueId, startDate, endDate);
        if (!slots.isEmpty()) {
            if (!slots.get(0).getPitch().getVenue().getOwner().getId().equals(ownerId)) {
                throw new AccessDeniedException("You do not own this venue");
            }
        }
        return slots;
    }
}
