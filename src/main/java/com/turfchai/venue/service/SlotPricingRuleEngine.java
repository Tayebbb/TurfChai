package com.turfchai.venue.service;

import com.turfchai.venue.dto.owner.SlotPriceResponse;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Determines the correct pricing rule and calculates total slot price.
 *
 * <p>Rule selection priority:
 * <ol>
 *   <li>Match by (venue, sport, days_of_week containing today's ISO day number)</li>
 *   <li>Among matching rules, prefer the one whose window contains the requested startTime</li>
 *   <li>If startTime falls in both OFF_PEAK and PEAK windows (overlap), prefer PEAK (higher revenue)</li>
 *   <li>If FULL_DAY rule exists and nothing else matches, use FULL_DAY</li>
 * </ol>
 */
@Service
@Transactional(readOnly = true)
public class SlotPricingRuleEngine {

    private final VenueRepository venueRepository;

    public SlotPricingRuleEngine(VenueRepository venueRepository) {
        this.venueRepository = venueRepository;
    }

    /**
     * Calculate the slot price for a booking window.
     *
     * @param venueId   venue to price
     * @param sportSlug sport slug e.g. "football"
     * @param date      booking date (used to determine day-of-week)
     * @param startTime slot start time
     * @param endTime   slot end time
     * @return the applicable rule and computed total price
     * @throws IllegalArgumentException if no active pricing rule can be found
     */
    public SlotPriceResponse calculate(Long venueId, String sportSlug,
                                       LocalDate date, LocalTime startTime, LocalTime endTime) {
        if (!endTime.isAfter(startTime)) {
            throw new IllegalArgumentException("endTime must be after startTime");
        }

        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new IllegalArgumentException("Venue not found: " + venueId));

        int isoDayOfWeek = date.getDayOfWeek().getValue(); // 1=Mon, 7=Sun

        // Collect active rules for the requested sport
        List<SportPricingRule> candidates = venue.getPricingRules().stream()
                .filter(SportPricingRule::isActive)
                .filter(rule -> rule.getSport().getSlug().equalsIgnoreCase(sportSlug))
                .filter(rule -> rule.getDaysOfWeek() == null
                        || rule.getDaysOfWeek().isEmpty()
                        || rule.getDaysOfWeek().contains(isoDayOfWeek))
                .toList();

        if (candidates.isEmpty()) {
            throw new IllegalArgumentException(
                    "No active pricing rule found for sport '%s' at venue %d".formatted(sportSlug, venueId));
        }

        // Find the best matching rule for the requested startTime
        Optional<SportPricingRule> matched = candidates.stream()
                .filter(rule -> !startTime.isBefore(rule.getWindowStart())
                        && startTime.isBefore(rule.getWindowEnd()))
                // PEAK beats OFF_PEAK beats FULL_DAY
                .max(Comparator.comparingInt(SlotPricingRuleEngine::windowPriority));

        SportPricingRule rule = matched.orElseGet(() ->
                // Fallback: use FULL_DAY if available, otherwise pick cheapest
                candidates.stream()
                        .filter(r -> "FULL_DAY".equals(r.getWindowType()))
                        .findFirst()
                        .orElse(candidates.stream()
                                .min(Comparator.comparing(SportPricingRule::getRate))
                                .orElseThrow())
        );

        // Calculate number of slots that fit in the requested window
        long totalMinutes = java.time.Duration.between(startTime, endTime).toMinutes();
        int slotStep = rule.getSlotDurationMin() + rule.getBufferMin();
        int numberOfSlots = Math.max(1, (int) (totalMinutes / slotStep));

        BigDecimal totalPrice = rule.getRate()
                .multiply(BigDecimal.valueOf(numberOfSlots))
                .setScale(2, RoundingMode.HALF_UP);

        return new SlotPriceResponse(
                rule.getRate(),
                rule.getSlotDurationMin(),
                rule.getBufferMin(),
                rule.getWindowType(),
                rule.getSport().getSlug(),
                date,
                startTime,
                endTime,
                totalPrice
        );
    }

    private static int windowPriority(SportPricingRule rule) {
        return switch (rule.getWindowType()) {
            case "PEAK"     -> 3;
            case "OFF_PEAK" -> 2;
            case "FULL_DAY" -> 1;
            default         -> 0;
        };
    }
}
