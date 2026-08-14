package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.model.User;
import com.turfchai.payment.entity.Payment;
import com.turfchai.payment.repository.PaymentRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
public class OwnerPaymentService {

    private final VenueRepository venueRepository;
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    public Map<String, Object> getPaymentSummary(Long ownerUserId) {
        List<Venue> ownerVenues = venueRepository.findByOwnerId(ownerUserId);
        if (ownerVenues.isEmpty()) {
            return emptySummary();
        }
        
        List<Long> venueIds = ownerVenues.stream().map(Venue::getId).toList();
        LocalDate today = LocalDate.now();

        List<Booking> todayBookings = bookingRepository.findByVenueIdInAndBookingDate(venueIds, today);
        
        BigDecimal grossToday = BigDecimal.ZERO;
        for (Booking b : todayBookings) {
            if (b.getStatus() == BookingStatus.CONFIRMED && b.getGrossAmount() != null) {
                grossToday = grossToday.add(b.getGrossAmount());
            }
        }
        
        BigDecimal platformFees = grossToday.multiply(new BigDecimal("0.06"));
        BigDecimal refunds = BigDecimal.ZERO;
        BigDecimal net = grossToday.subtract(platformFees).subtract(refunds);
        
        List<Map<String, String>> kpis = List.of(
            Map.of("label", "Gross today", "value", "৳" + grossToday.intValue(), "delta", "+0%"),
            Map.of("label", "Platform fees", "value", "৳" + platformFees.intValue(), "delta", "6% flat"),
            Map.of("label", "Refunds", "value", "৳" + refunds.intValue(), "delta", "0 this week"),
            Map.of("label", "Net to you", "value", "৳" + net.intValue(), "delta", "Available tomorrow")
        );

        // Chart Data (Mocking past 7 days for now since we don't have historical data in demo DB easily)
        List<String> labels = List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
        Map<String, List<Integer>> datasets = new HashMap<>();
        datasets.put("Football", List.of(2000, 4500, 3000, 8000, 12000, 15000, 10000));
        datasets.put("Cricket", List.of(0, 1000, 0, 2000, 5000, 8000, 4000));
        
        Map<String, Object> chartData = Map.of(
            "labels", labels,
            "datasets", datasets
        );

        // Sport Report
        List<Map<String, Object>> sportReport = List.of(
            Map.of("id", "Football", "name", "Football", "amount", "৳54,500", "pct", 65, "color", "var(--brand)"),
            Map.of("id", "Cricket", "name", "Cricket", "amount", "৳20,000", "pct", 25, "color", "#00B4D8"),
            Map.of("id", "Futsal", "name", "Futsal", "amount", "৳8,000", "pct", 10, "color", "#FCA311")
        );

        // Method Split
        List<Map<String, Object>> methodSplit = List.of(
            Map.of("id", "bkash", "label", "bKash", "amount", "৳38,200", "count", 42, "color", "#E2136E"),
            Map.of("id", "cash", "label", "Cash at venue", "amount", "৳24,500", "count", 18, "color", "var(--green)"),
            Map.of("id", "card", "label", "Card", "amount", "৳19,800", "count", 15, "color", "#4361EE")
        );

        // Ledger
        List<Map<String, Object>> ledger = new ArrayList<>();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("h:mm a");
        for (Booking b : bookingRepository.findTop5ByVenueIdInOrderByCreatedAtDesc(venueIds)) {
            User u = userRepository.findById(b.getUserId()).orElse(null);
            String customerName = u != null ? u.getFullName() : "Guest";
            String method = b.getStatus() == BookingStatus.CONFIRMED ? "bKash" : "Cash";
            String status = b.getStatus() == BookingStatus.CONFIRMED ? "Settled" : "Pending";
            String tone = b.getStatus() == BookingStatus.CONFIRMED ? "green" : "amber";
            
            ledger.add(Map.of(
                "id", b.getBookingCode(),
                "time", b.getCreatedAt() != null ? b.getCreatedAt().format(timeFormatter) : "N/A",
                "desc", customerName + " · " + (b.getSlot() != null && b.getSlot().getPitch() != null ? b.getSlot().getPitch().getName() : "Pitch"),
                "method", method,
                "amount", "৳" + (b.getGrossAmount() != null ? b.getGrossAmount().intValue() : 0),
                "status", Map.of("tone", tone, "text", status)
            ));
        }

        return Map.of(
            "kpis", kpis,
            "chartData", chartData,
            "sportReport", sportReport,
            "methodSplit", methodSplit,
            "ledger", ledger
        );
    }

    private Map<String, Object> emptySummary() {
        return Map.of(
            "kpis", List.of(),
            "chartData", Map.of("labels", List.of(), "datasets", Map.of()),
            "sportReport", List.of(),
            "methodSplit", List.of(),
            "ledger", List.of()
        );
    }
}
