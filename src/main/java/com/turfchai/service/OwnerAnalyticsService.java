package com.turfchai.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OwnerAnalyticsService {

    private final VenueRepository venueRepository;
    private final BookingRepository bookingRepository;
    private final SlotRepository slotRepository;
    private final UserRepository userRepository;

    public Map<String, Object> getDashboardData(Long ownerUserId) {
        List<Venue> ownerVenues = venueRepository.findByOwnerId(ownerUserId);
        if (ownerVenues.isEmpty()) {
            return emptyDashboard();
        }

        List<Long> venueIds = ownerVenues.stream().map(Venue::getId).toList();
        LocalDate today = LocalDate.now();

        List<Booking> allOwnerBookings = bookingRepository.findByVenueIdIn(venueIds);
        List<Booking> todayBookings = new ArrayList<>();

        int bookedCount = 0;
        BigDecimal grossRevenue = BigDecimal.ZERO;
        int pendingPayments = 0;

        for (Booking b : allOwnerBookings) {
            // Played today, not *sold* today. Counting a booking because it was
            // created today put next week's fixtures into today's takings, and
            // the same money would be counted again on the day it is played --
            // while the Occupancy KPI beside it, measured from today's slots,
            // reported nothing booked.
            boolean isToday = today.equals(b.getBookingDate());
            if (isToday) {
                todayBookings.add(b);
                if (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING) {
                    bookedCount++;
                    if (b.getGrossAmount() != null) {
                        grossRevenue = grossRevenue.add(b.getGrossAmount());
                    }
                    if (b.getStatus() == BookingStatus.PENDING) {
                        pendingPayments++;
                    }
                }
            }
        }

        // Occupancy is booked-or-held slots over the slots that exist for today.
        // With no slots published there is no denominator, so it reports "--"
        // rather than the 100% this used to hardcode.
        List<Slot> todaySlots = slotRepository.findByVenueIdInAndSlotDateBetween(venueIds, today, today);
        long occupiedSlots = todaySlots.stream()
                .filter(s -> s.getStatus() == SlotStatus.BOOKED || s.getStatus() == SlotStatus.HELD)
                .count();
        String occupancyValue = todaySlots.isEmpty()
                ? "—"
                : Math.round(100.0 * occupiedSlots / todaySlots.size()) + "%";
        String occupancyDelta = todaySlots.isEmpty()
                ? "No slots published for today"
                : occupiedSlots + " of " + todaySlots.size() + " slots today";

        // KPIs
        List<Map<String, Object>> kpis = List.of(
                Map.of("label", "Today's revenue", "value", "৳" + grossRevenue.intValue(), "delta", "", "trend", ""),
                Map.of("label", "Bookings today", "value", String.valueOf(bookedCount), "delta", "", "trend", ""),
                Map.of("label", "Occupancy", "value", occupancyValue, "delta", occupancyDelta, "trend", ""),
                Map.of("label", "Pending payments", "value", String.valueOf(pendingPayments), "delta", "", "trend",
                        ""));

        // Next Up
        List<Map<String, Object>> nextUp = new ArrayList<>();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
        for (Booking b : todayBookings) {
            if (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING) {
                User u = userRepository.findById(b.getUserId()).orElse(null);
                boolean isManual = b.getBookingCode() != null && b.getBookingCode().startsWith("MB-");
                String customerName = isManual ? "Manual Walk-in" : (u != null ? u.getFullName() : "Guest");
                String pitchName = b.getSlot() != null && b.getSlot().getPitch() != null
                        ? b.getSlot().getPitch().getName()
                        : "Pitch";
                String timeStr = b.getStartTime() != null ? b.getStartTime().format(timeFormatter) : "N/A";

                Map<String, Object> nu = new HashMap<>();
                nu.put("id", String.valueOf(b.getId()));
                nu.put("slot", timeStr + " · " + pitchName);

                String tone = b.getStatus() == BookingStatus.CONFIRMED ? "green" : "amber";
                String text = b.getStatus() == BookingStatus.CONFIRMED ? (isManual ? "Paid (Cash)" : "Paid") : "Unpaid";
                nu.put("badge", Map.of("tone", tone, "text", text));

                nu.put("detail", customerName + " · " + b.getBookingCode());
                nu.put("action",
                        Map.of("kind", "link", "to", "/owner/bookings", "label", "Detail", "variant", "secondary"));
                nextUp.add(nu);
            }
        }
        if (nextUp.size() > 5)
            nextUp = nextUp.subList(0, 5);

        // Activity
        List<Booking> recentBookings = bookingRepository.findTop5ByVenueIdInOrderByCreatedAtDesc(venueIds);
        List<Map<String, Object>> activity = new ArrayList<>();
        for (Booking b : recentBookings) {
            User u = userRepository.findById(b.getUserId()).orElse(null);
            boolean isManual = b.getBookingCode() != null && b.getBookingCode().startsWith("MB-");
            String customerName = isManual ? "Manual Booking (Walk-in)" : (u != null ? u.getFullName() : "Guest");
            String pitchName = b.getSlot() != null && b.getSlot().getPitch() != null ? b.getSlot().getPitch().getName()
                    : "Pitch";

            Map<String, Object> act = new HashMap<>();
            act.put("id", String.valueOf(b.getId()));
            act.put("title", "New booking: " + pitchName);
            act.put("detail",
                    customerName + " booked for " + b.getBookingDate() + " · " + relativeTime(b.getCreatedAt()));
            activity.add(act);
        }

        // Attention
        List<Map<String, Object>> attention = new ArrayList<>();
        if (pendingPayments > 0) {
            attention.add(Map.of(
                    "id", "deposits",
                    "tone", "warn",
                    "icon", "💰",
                    "title", pendingPayments + " deposits awaiting collection",
                    "body", "Review pending bookings.",
                    "link", Map.of("to", "/owner/bookings?filter=pending", "label", "View bookings")));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("kpis", kpis);
        response.put("nextUp", nextUp);
        response.put("activity", activity);
        response.put("weekly", weeklyPerformance(venueIds, allOwnerBookings, today));
        response.put("attention", attention);

        return response;
    }

    /**
     * Last seven days of real trade: takings, week-on-week movement, slot
     * occupancy and where the bookings came from. The dashboard card that shows
     * this used to be four hardcoded literals (a "৳96,700 / ৳110,000" revenue
     * goal, 68% occupancy and a 61/22/17 channel split) on every venue.
     */
    private Map<String, Object> weeklyPerformance(List<Long> venueIds, List<Booking> allOwnerBookings,
            LocalDate today) {
        LocalDate weekStart = today.minusDays(6);
        LocalDate priorStart = today.minusDays(13);
        LocalDate priorEnd = today.minusDays(7);

        BigDecimal thisWeek = BigDecimal.ZERO;
        BigDecimal lastWeek = BigDecimal.ZERO;
        int online = 0;
        int manual = 0;

        for (Booking b : allOwnerBookings) {
            LocalDate date = b.getBookingDate();
            if (date == null || b.getStatus() != BookingStatus.CONFIRMED) {
                continue;
            }
            BigDecimal amount = b.getGrossAmount() != null ? b.getGrossAmount() : BigDecimal.ZERO;
            if (!date.isBefore(weekStart) && !date.isAfter(today)) {
                thisWeek = thisWeek.add(amount);
                if (b.getBookingCode() != null && b.getBookingCode().startsWith("MB-")) {
                    manual++;
                } else {
                    online++;
                }
            } else if (!date.isBefore(priorStart) && !date.isAfter(priorEnd)) {
                lastWeek = lastWeek.add(amount);
            }
        }

        List<Slot> weekSlots = slotRepository.findByVenueIdInAndSlotDateBetween(venueIds, weekStart, today);
        long bookedSlots = weekSlots.stream().filter(s -> s.getStatus() == SlotStatus.BOOKED).count();

        Map<String, Object> weekly = new HashMap<>();
        weekly.put("revenue", thisWeek.intValue());
        weekly.put("previousRevenue", lastWeek.intValue());
        weekly.put("occupancyPercent", weekSlots.isEmpty()
                ? null
                : (int) Math.round(100.0 * bookedSlots / weekSlots.size()));
        weekly.put("slotsBooked", bookedSlots);
        weekly.put("slotsPublished", weekSlots.size());
        // The schema records manual bookings but cannot tell a phone booking
        // from a walk-in, so those are reported together rather than split.
        weekly.put("onlineBookings", online);
        weekly.put("manualBookings", manual);
        return weekly;
    }

    /** "Just now" was stamped on every row regardless of when it was created. */
    private String relativeTime(OffsetDateTime createdAt) {
        if (createdAt == null) {
            return "time unknown";
        }
        long minutes = Duration.between(createdAt, OffsetDateTime.now()).toMinutes();
        if (minutes < 1)
            return "Just now";
        if (minutes < 60)
            return minutes + " min ago";
        long hours = minutes / 60;
        if (hours < 24)
            return hours + (hours == 1 ? " hour ago" : " hours ago");
        long days = hours / 24;
        return days + (days == 1 ? " day ago" : " days ago");
    }

    private Map<String, Object> emptyDashboard() {
        List<Map<String, Object>> kpis = List.of(
                Map.of("label", "Today's revenue", "value", "৳0", "delta", "", "trend", ""),
                Map.of("label", "Bookings today", "value", "0", "delta", "", "trend", ""),
                Map.of("label", "Occupancy", "value", "—", "delta", "No venue yet", "trend", ""),
                Map.of("label", "Pending payments", "value", "0", "delta", "", "trend", ""));
        return Map.of(
                "kpis", kpis,
                "nextUp", List.of(),
                "activity", List.of(),
                "attention", List.of());
    }
}
