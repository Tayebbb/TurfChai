package com.turfchai.booking.service;

import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.SportPricingRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Read-side slot availability with on-demand generation. Slots have no
 * generation job: the startup seeder only covers today and tomorrow, so
 * without this the venue page's 7-day strip would show empty availability
 * for every later day and players could never select a slot. Mirrors the
 * owner calendar's auto-seed ({@code VenueManagementService#seedSlotsForDate})
 * but reuses the venue's active pricing rules when it can, so the times and
 * rates match what the owner configured.
 */
@Service
@RequiredArgsConstructor
public class SlotAvailabilityService {

    /**
     * Fallback times when the venue has no pricing rules to derive windows from.
     */
    private static final LocalTime[] DEFAULT_START_TIMES = {
            LocalTime.of(7, 0), LocalTime.of(9, 30), LocalTime.of(16, 0),
            LocalTime.of(17, 30), LocalTime.of(19, 0), LocalTime.of(20, 30)
    };
    private static final int DEFAULT_DURATION_MIN = 90;
    private static final BigDecimal OFF_PEAK_RATE = BigDecimal.valueOf(2000);
    private static final BigDecimal PEAK_RATE = BigDecimal.valueOf(2500);
    private static final LocalTime PEAK_THRESHOLD = LocalTime.of(16, 0);

    private final SlotRepository slotRepository;
    private final PitchRepository pitchRepository;
    private final SportPricingRuleRepository pricingRuleRepository;
    private final SlotTimePolicy slotTimePolicy;

    /**
     * A venue's bookable slots for one day, creating them on first request for
     * that date. Existing rows always win — a refetch or a later visitor sees
     * exactly what is already persisted, so availability stays consistent.
     *
     * <p>
     * Generation is bounded to {@link SlotTimePolicy#mayGenerateFor}: a past
     * date returns only what history already holds (never new rows), and dates
     * beyond the horizon are not materialised at all. Both limits exist because
     * this endpoint is public and unauthenticated, so anything it creates on
     * demand is creatable by anyone.
     */
    @Transactional
    public List<Slot> ensureSlots(Long venueId, LocalDate date) {
        List<Slot> existing = slotRepository.findByVenueIdAndSlotDateOrderByStartTimeAsc(venueId, date);
        if (!existing.isEmpty() || !slotTimePolicy.mayGenerateFor(date)) {
            return existing;
        }

        List<Pitch> pitches = pitchRepository.findByVenueIdAndActiveTrue(venueId);
        if (pitches.isEmpty()) {
            pitches = pitchRepository.findByVenueId(venueId);
        }
        if (pitches.isEmpty()) {
            return List.of();
        }

        List<SportPricingRule> rules = pricingRuleRepository.findActiveByVenueId(venueId);

        List<Slot> created = new ArrayList<>();
        Set<String> plannedKeys = new HashSet<>();
        for (Pitch pitch : pitches) {
            created.addAll(generateForPitch(venueId, pitch, date, rules, plannedKeys));
        }
        return created.isEmpty() ? created : slotRepository.saveAll(created);
    }

    private List<Slot> generateForPitch(Long venueId, Pitch pitch, LocalDate date, List<SportPricingRule> rules, Set<String> plannedKeys) {
        List<SportPricingRule> pitchRules = rules.stream()
                .filter(r -> appliesToPitch(pitch, r))
                .filter(r -> appliesOn(r, date))
                .sorted(Comparator.comparing(SportPricingRule::getWindowStart, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        if (pitchRules.isEmpty()) {
            pitchRules = rules.stream()
                    .filter(r -> appliesOn(r, date))
                    .sorted(Comparator.comparing(SportPricingRule::getWindowStart, Comparator.nullsLast(Comparator.naturalOrder())))
                    .toList();
        }

        List<Slot> slots = new ArrayList<>();
        for (SportPricingRule rule : pitchRules) {
            slots.addAll(generateWindow(venueId, pitch, date, rule, plannedKeys));
        }
        // Rules that produce nothing (e.g. a window shorter than one slot) must
        // not leave the pitch with zero bookable times.
        return slots.isEmpty() ? generateDefaults(venueId, pitch, date, plannedKeys) : slots;
    }

    private boolean appliesToPitch(Pitch pitch, SportPricingRule rule) {
        if (pitch == null || pitch.getSports() == null || pitch.getSports().isEmpty() || rule.getSport() == null) {
            return true;
        }
        return pitch.getSports().stream().anyMatch(s -> s.getId().equals(rule.getSport().getId()));
    }

    private boolean appliesOn(SportPricingRule rule, LocalDate date) {
        return rule.getDaysOfWeek() == null
                || rule.getDaysOfWeek().isEmpty()
                || rule.getDaysOfWeek().contains(date.getDayOfWeek().getValue());
    }

    private List<Slot> generateWindow(Long venueId, Pitch pitch, LocalDate date, SportPricingRule rule, Set<String> plannedKeys) {
        List<Slot> slots = new ArrayList<>();
        int duration = rule.getSlotDurationMin() > 0 ? rule.getSlotDurationMin() : DEFAULT_DURATION_MIN;
        int buffer = Math.max(0, rule.getBufferMin());
        int step = duration + buffer;
        LocalTime cursor = rule.getWindowStart() != null ? rule.getWindowStart() : LocalTime.of(6, 0);
        LocalTime windowEnd = rule.getWindowEnd() != null ? rule.getWindowEnd() : LocalTime.of(23, 30);

        while (cursor != null && !cursor.plusMinutes(duration).isAfter(windowEnd)) {
            LocalTime end = cursor.plusMinutes(duration);
            String key = pitch.getId() + "@" + cursor;
            if (!plannedKeys.contains(key) && !slotRepository.existsByPitchIdAndSlotDateAndStartTime(pitch.getId(), date, cursor)) {
                plannedKeys.add(key);
                slots.add(Slot.builder()
                        .pitch(pitch)
                        .venueId(venueId)
                        .slotDate(date)
                        .price(rule.getRate())
                        .startTime(cursor)
                        .endTime(end)
                        .status(SlotStatus.AVAILABLE)
                        .build());
            }
            if (cursor.plusMinutes(step).isBefore(cursor)) {
                break;
            }
            cursor = cursor.plusMinutes(step);
        }
        return slots;
    }

    private List<Slot> generateDefaults(Long venueId, Pitch pitch, LocalDate date, Set<String> plannedKeys) {
        List<Slot> slots = new ArrayList<>();
        for (LocalTime start : DEFAULT_START_TIMES) {
            String key = pitch.getId() + "@" + start;
            if (!plannedKeys.contains(key) && !slotRepository.existsByPitchIdAndSlotDateAndStartTime(pitch.getId(), date, start)) {
                plannedKeys.add(key);
                boolean offPeak = start.isBefore(PEAK_THRESHOLD);
                slots.add(Slot.builder()
                        .pitch(pitch)
                        .venueId(venueId)
                        .slotDate(date)
                        .price(offPeak ? OFF_PEAK_RATE : PEAK_RATE)
                        .startTime(start)
                        .endTime(start.plusMinutes(DEFAULT_DURATION_MIN))
                        .status(SlotStatus.AVAILABLE)
                        .build());
            }
        }
        return slots;
    }
}