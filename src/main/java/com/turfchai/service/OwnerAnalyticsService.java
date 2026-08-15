package com.turfchai.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
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
import java.time.LocalDate;
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
            boolean isToday = (b.getBookingDate() != null && today.equals(b.getBookingDate())) ||
                              (b.getCreatedAt() != null && today.equals(b.getCreatedAt().toLocalDate()));
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

        // KPIs
        List<Map<String, Object>> kpis = List.of(
            Map.of("label", "Today's revenue", "value", "৳" + grossRevenue.intValue(), "delta", "", "trend", ""),
            Map.of("label", "Bookings today", "value", String.valueOf(bookedCount), "delta", "", "trend", ""),
            Map.of("label", "Occupancy", "value", "100%", "delta", "", "trend", ""),
            Map.of("label", "Pending payments", "value", String.valueOf(pendingPayments), "delta", "", "trend", "")
        );

        // Next Up
        List<Map<String, Object>> nextUp = new ArrayList<>();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("HH:mm");
        for (Booking b : todayBookings) {
            if (b.getStatus() == BookingStatus.CONFIRMED || b.getStatus() == BookingStatus.PENDING) {
                User u = userRepository.findById(b.getUserId()).orElse(null);
                boolean isManual = b.getBookingCode() != null && b.getBookingCode().startsWith("MB-");
                String customerName = isManual ? "Manual Walk-in" : (u != null ? u.getFullName() : "Guest");
                String pitchName = b.getSlot() != null && b.getSlot().getPitch() != null ? b.getSlot().getPitch().getName() : "Pitch";
                String timeStr = b.getStartTime() != null ? b.getStartTime().format(timeFormatter) : "N/A";
                
                Map<String, Object> nu = new HashMap<>();
                nu.put("id", String.valueOf(b.getId()));
                nu.put("slot", timeStr + " · " + pitchName);
                
                String tone = b.getStatus() == BookingStatus.CONFIRMED ? "green" : "amber";
                String text = b.getStatus() == BookingStatus.CONFIRMED ? (isManual ? "Paid (Cash)" : "Paid") : "Unpaid";
                nu.put("badge", Map.of("tone", tone, "text", text));
                
                nu.put("detail", customerName + " · " + b.getBookingCode());
                nu.put("action", Map.of("kind", "link", "to", "/owner/bookings", "label", "Detail", "variant", "secondary"));
                nextUp.add(nu);
            }
        }
        if (nextUp.size() > 5) nextUp = nextUp.subList(0, 5);

        // Activity
        List<Booking> recentBookings = bookingRepository.findTop5ByVenueIdInOrderByCreatedAtDesc(venueIds);
        List<Map<String, Object>> activity = new ArrayList<>();
        for (Booking b : recentBookings) {
            User u = userRepository.findById(b.getUserId()).orElse(null);
            boolean isManual = b.getBookingCode() != null && b.getBookingCode().startsWith("MB-");
            String customerName = isManual ? "Manual Booking (Walk-in)" : (u != null ? u.getFullName() : "Guest");
            String pitchName = b.getSlot() != null && b.getSlot().getPitch() != null ? b.getSlot().getPitch().getName() : "Pitch";
            
            Map<String, Object> act = new HashMap<>();
            act.put("id", String.valueOf(b.getId()));
            act.put("title", "New booking: " + pitchName);
            act.put("detail", customerName + " booked for " + b.getBookingDate() + " · Just now");
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
                "link", Map.of("to", "/owner/bookings?filter=pending", "label", "View bookings")
            ));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("kpis", kpis);
        response.put("nextUp", nextUp);
        response.put("activity", activity);
        response.put("attention", attention);

        return response;
    }

    private Map<String, Object> emptyDashboard() {
        List<Map<String, Object>> kpis = List.of(
            Map.of("label", "Today's revenue", "value", "৳0", "delta", "", "trend", ""),
            Map.of("label", "Bookings today", "value", "0", "delta", "", "trend", ""),
            Map.of("label", "Occupancy", "value", "0%", "delta", "", "trend", ""),
            Map.of("label", "Pending payments", "value", "0", "delta", "", "trend", "")
        );
        return Map.of(
            "kpis", kpis,
            "nextUp", List.of(),
            "activity", List.of(),
            "attention", List.of()
        );
    }
}
