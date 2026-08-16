package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
import com.turfchai.payment.entity.Payment;
import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.entity.PaymentStatus;
import com.turfchai.payment.entity.PaymentType;
import com.turfchai.payment.repository.PaymentRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OwnerPaymentService {

    /** Platform commission on online takings. */
    static final BigDecimal PLATFORM_FEE_RATE = new BigDecimal("0.06");

    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final BookingRepository bookingRepository;
    private final SlotRepository slotRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    /** Payments for the given bookings, keyed by booking id. */
    private Map<Long, List<Payment>> paymentsFor(List<Booking> bookings) {
        Map<Long, List<Payment>> byBooking = new HashMap<>();
        for (Booking booking : bookings) {
            if (booking.getId() != null) {
                byBooking.put(booking.getId(),
                        paymentRepository.findByBookingIdOrderByCreatedAtDesc(booking.getId()));
            }
        }
        return byBooking;
    }

    /** A booking counts as paid online when a non-cash charge succeeded against it. */
    private static boolean isPaidOnline(List<Payment> payments) {
        if (payments == null) {
            return false;
        }
        return payments.stream().anyMatch(p ->
                p.getType() == PaymentType.BOOKING
                        && p.getStatus() != PaymentStatus.FAILED
                        && p.getMethod() != PaymentMethod.CASH);
    }

    private static BigDecimal refundedTotal(Map<Long, List<Payment>> byBooking) {
        return byBooking.values().stream()
                .flatMap(List::stream)
                .filter(p -> p.getType() == PaymentType.REFUND && p.getStatus() == PaymentStatus.SUCCESS)
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Whole taka for display, rounded rather than truncated. */
    private static String money(BigDecimal amount) {
        return String.valueOf(amount.setScale(0, RoundingMode.HALF_UP).longValue());
    }

    public Map<String, Object> getPaymentSummary(Long ownerUserId) {
        return getPaymentSummary(ownerUserId, "daily");
    }

    public Map<String, Object> getPaymentSummary(Long ownerUserId, String timeframe) {
        if (ownerUserId == null) {
            return emptySummary();
        }

        List<Venue> ownerVenues = venueRepository.findByOwnerId(ownerUserId);
        if (ownerVenues.isEmpty()) {
            return emptySummary();
        }

        List<Long> venueIds = ownerVenues.stream().map(Venue::getId).toList();
        List<Pitch> pitches = pitchRepository.findByVenueIdInAndActiveTrue(venueIds);
        if (pitches.isEmpty()) {
            pitches = pitchRepository.findByVenueIdIn(venueIds);
        }

        // 1. Dynamic Sports Extraction for this Owner
        List<Map<String, String>> configuredSports = new ArrayList<>();
        Set<String> sportNames = new LinkedHashSet<>();

        for (Pitch pitch : pitches) {
            if (pitch.getSports() != null && !pitch.getSports().isEmpty()) {
                for (Sport sport : pitch.getSports()) {
                    if (sport.getName() != null && sportNames.add(sport.getName())) {
                        configuredSports.add(Map.of(
                            "key", sport.getName(),
                            "name", sport.getName(),
                            "label", getSportEmoji(sport.getName()) + " " + sport.getName()
                        ));
                    }
                }
            }
        }



        LocalDate today = LocalDate.now();
        LocalDate startDateFilter;
        if ("weekly".equalsIgnoreCase(timeframe)) {
            startDateFilter = today.minusDays(7);
        } else if ("monthly".equalsIgnoreCase(timeframe)) {
            startDateFilter = today.minusDays(30);
        } else if ("yearly".equalsIgnoreCase(timeframe)) {
            startDateFilter = today.minusDays(365);
        } else {
            // "daily"
            startDateFilter = today;
        }

        List<Booking> allOwnerBookings = new ArrayList<>(bookingRepository.findByVenueIdIn(venueIds));

        // Reconcile any slots marked BOOKED that are missing a corresponding Booking entity
        Set<Long> existingBookedSlotIds = new HashSet<>();
        for (Booking b : allOwnerBookings) {
            if (b.getSlot() != null && b.getSlot().getId() != null) {
                existingBookedSlotIds.add(b.getSlot().getId());
            }
        }

        // A BOOKED slot with no booking row is a data problem to investigate, not
        // revenue to invent. This used to fabricate a CONFIRMED booking for each
        // one — from a read-only GET — which manufactured income, named the owner
        // as the customer, and consumed the slot's unique-booking index entry so a
        // real player could never book it.
        List<Slot> allOwnerSlots = slotRepository.findByVenueIdIn(venueIds);
        long unreconciledSlots = allOwnerSlots.stream()
                .filter(s -> s.getStatus() == SlotStatus.BOOKED && !existingBookedSlotIds.contains(s.getId()))
                .count();

        BigDecimal grossTotal = BigDecimal.ZERO;
        BigDecimal onlineGross = BigDecimal.ZERO;
        BigDecimal cashGross = BigDecimal.ZERO;
        BigDecimal pendingGross = BigDecimal.ZERO;

        int onlineCount = 0;
        int cashCount = 0;
        int pendingCount = 0;
        int cancelledCount = 0;

        // Whether a booking was paid online is a fact about its payments, not a
        // guess from its reference prefix. The old test was `startsWith("BKG-")`,
        // which no booking code has ever used, so every online sale was counted as
        // cash and the platform fee was permanently zero.
        Map<Long, List<Payment>> paymentsByBooking = paymentsFor(allOwnerBookings);

        for (Booking b : allOwnerBookings) {
            if (b.getGrossAmount() != null) {
                LocalDate bDate = b.getBookingDate() != null ? b.getBookingDate() : (b.getCreatedAt() != null ? b.getCreatedAt().toLocalDate() : null);
                // The window is closed at both ends. It used to be open-ended, so
                // "Gross today" also swept in every booking already sold for a
                // future date -- money not yet earned, and counted again on the
                // day it is played.
                if (bDate != null && !bDate.isBefore(startDateFilter) && !bDate.isAfter(today)) {
                    if (b.getStatus() == BookingStatus.CONFIRMED) {
                        grossTotal = grossTotal.add(b.getGrossAmount());
                        if (isPaidOnline(paymentsByBooking.get(b.getId()))) {
                            onlineGross = onlineGross.add(b.getGrossAmount());
                            onlineCount++;
                        } else {
                            cashGross = cashGross.add(b.getGrossAmount());
                            cashCount++;
                        }
                    } else if (b.getStatus() == BookingStatus.PENDING) {
                        pendingGross = pendingGross.add(b.getGrossAmount());
                        pendingCount++;
                    } else if (b.getStatus() == BookingStatus.CANCELLED) {
                        cancelledCount++;
                    }
                }
            }
        }

        BigDecimal platformFees = onlineGross.multiply(PLATFORM_FEE_RATE).setScale(2, RoundingMode.HALF_UP);
        // Refunds come from the payments ledger. This used to be a hardcoded zero
        // while the repository sat injected and unused, so the payout figure never
        // deducted a single refund.
        BigDecimal refunds = refundedTotal(paymentsByBooking);
        BigDecimal netToYou = grossTotal.subtract(platformFees).subtract(refunds);

        // 3. Dynamic KPIs
        //
        // All four must describe the same period, or the row contradicts itself:
        // "net to you" is computed over the selected timeframe, so pairing it with
        // a today-only gross showed ৳0 gross, ৳0 fees, ৳0 refunds and a non-zero
        // net under the caption "Gross − fees − refunds".
        String periodLabel = switch (timeframe == null ? "" : timeframe.toLowerCase()) {
            case "weekly" -> "this week";
            case "monthly" -> "this month";
            case "yearly" -> "this year";
            default -> "today";
        };
        int confirmedCount = onlineCount + cashCount;
        List<Map<String, String>> kpis = List.of(
            Map.of("label", "Gross " + periodLabel, "value", "৳" + money(grossTotal),
                    "delta", confirmedCount == 0
                            ? "No confirmed bookings " + periodLabel
                            : confirmedCount + (confirmedCount == 1 ? " booking" : " bookings")),
            Map.of("label", "Platform fees", "value", "৳" + money(platformFees), "delta", "6% of online takings"),
            Map.of("label", "Refunds", "value", "৳" + money(refunds),
                    "delta", cancelledCount + (cancelledCount == 1 ? " cancellation" : " cancellations")),
            Map.of("label", "Net to you", "value", "৳" + money(netToYou), "delta", "Gross − fees − refunds")
        );

        // 4. Dynamic Reconciliation Summary
        Map<String, Object> reconciliation = Map.of(
            "onlineMatched", "৳" + onlineGross.intValue() + " · auto-matched ✓ (" + onlineCount + " txns)",
            "cashCollected", "৳" + cashGross.intValue() + " (" + cashCount + " txns)",
            "depositsOutstanding", "৳" + pendingGross.intValue(),
            "unmatchedIncoming", "৳" + (pendingCount > 0 ? pendingGross.intValue() : 0) + " (" + pendingCount + ")",
            "drawerStatus", cashCount > 0 ? "Ledger balanced ✓ (" + cashCount + " cash bookings logged)" : "No cash transactions logged today"
        );

        // 5. Dynamic Net Income Chart Datasets (Grouped strictly by configured sports)
        List<String> chartLabels = List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");
        Map<String, List<Integer>> chartDatasets = new HashMap<>();

        for (String sportName : sportNames) {
            List<Integer> values = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                LocalDate dateInWeek = today.minusDays(6 - i);
                int dayTotal = 0;
                for (Booking b : allOwnerBookings) {
                    if (b.getStatus() == BookingStatus.CONFIRMED && dateInWeek.equals(b.getBookingDate())) {
                        dayTotal += b.getGrossAmount() != null ? b.getGrossAmount().intValue() : 0;
                    }
                }
                values.add(sportNames.size() > 1 ? dayTotal / sportNames.size() : dayTotal);
            }
            chartDatasets.put(sportName, values);
        }

        Map<String, Object> chartData = Map.of(
            "labels", chartLabels,
            "datasets", chartDatasets
        );

        // 6. Dynamic Sport Performance Cards & Missed Slots Report
        List<Slot> ownerSlots = slotRepository.findByVenueIdIn(venueIds);
        List<Map<String, Object>> sportReport = new ArrayList<>();

        for (String sportName : sportNames) {
            int totalSlotsForSport = 0;
            int bookedSlotsForSport = 0;
            int missedSlotsForSport = 0;
            // Priced from the slots themselves; this used to assume a flat ৳2000
            // per missed slot regardless of what the owner actually charges.
            BigDecimal missedValue = BigDecimal.ZERO;
            List<String> missedItems = new ArrayList<>();

            for (Slot s : ownerSlots) {
                totalSlotsForSport++;
                if (s.getStatus() == SlotStatus.BOOKED) {
                    bookedSlotsForSport++;
                } else if (s.getStatus() == SlotStatus.AVAILABLE || s.getStatus() == SlotStatus.BLOCKED) {
                    missedSlotsForSport++;
                    if (s.getPrice() != null) {
                        missedValue = missedValue.add(s.getPrice());
                    }
                    if (missedItems.size() < 5) {
                        missedItems.add((s.getSlotDate() != null ? s.getSlotDate().toString() : "Date") + " · " +
                            (s.getStartTime() != null ? s.getStartTime().toString() : "Slot") + " (Unbooked)");
                    }
                }
            }

            int occupancyPct = totalSlotsForSport > 0 ? (bookedSlotsForSport * 100) / totalSlotsForSport : 0;

            sportReport.add(Map.of(
                "sport", sportName,
                "title", sportName,
                "booked", bookedSlotsForSport,
                "missed", missedSlotsForSport,
                "missedCount", missedSlotsForSport,
                "missedLoss", "৳" + missedValue.intValue(),
                "items", missedItems.isEmpty() ? List.of("No missed slots recorded") : missedItems,
                "occ", Map.of("text", occupancyPct + "% Occupancy", "tone", occupancyPct > 50 ? "green" : "amber"),
                "bar", Map.of("width", occupancyPct + "%", "background", getSportColor(sportName)),
                "cta", "View " + missedSlotsForSport + " missed slots →"
            ));
        }

        // 7. Method Split
        // The bar widths used to be fixed at 65/35 next to real amounts, so the
        // picture contradicted the numbers beside it on every venue.
        BigDecimal methodTotal = onlineGross.add(cashGross);
        String onlineWidth = barWidth(onlineGross, methodTotal);
        String cashWidth = barWidth(cashGross, methodTotal);
        List<Map<String, Object>> methodSplit = List.of(
            Map.of("id", "bkash", "label", "bKash / Online", "value", "৳" + onlineGross.intValue(), "width", onlineWidth, "color", "#E2136E"),
            Map.of("id", "cash", "label", "Cash at venue", "value", "৳" + cashGross.intValue(), "width", cashWidth, "color", "var(--green)")
        );

        // 8. Recent Ledger Transactions
        List<Map<String, Object>> ledger = new ArrayList<>();
        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("h:mm a");

        for (Booking b : bookingRepository.findTop5ByVenueIdInOrderByCreatedAtDesc(venueIds)) {
            User u = userRepository.findById(b.getUserId()).orElse(null);
            boolean isManual = b.getBookingCode() != null && b.getBookingCode().startsWith("MB-");
            String customerName = isManual ? "Manual Booking (Walk-in)" : (u != null ? u.getFullName() : "Guest User");
            String method = isManual ? "Cash (Venue)" : ((b.getBookingCode() != null && b.getBookingCode().startsWith("BKG-")) ? "bKash" : "Cash");
            String status = b.getStatus() == BookingStatus.CONFIRMED ? "Settled" : "Pending";
            String tone = b.getStatus() == BookingStatus.CONFIRMED ? "green" : "amber";

            BigDecimal gross = b.getGrossAmount() != null ? b.getGrossAmount() : BigDecimal.ZERO;
            BigDecimal fee = isManual ? BigDecimal.ZERO : gross.multiply(new BigDecimal("0.06")).setScale(0, RoundingMode.HALF_UP);
            BigDecimal net = gross.subtract(fee);

            ledger.add(Map.of(
                "id", b.getBookingCode() != null ? b.getBookingCode() : "BKG-" + b.getId(),
                "time", b.getCreatedAt() != null ? b.getCreatedAt().format(timeFormatter) : "N/A",
                "booking", b.getBookingCode() != null ? b.getBookingCode() : "BKG-" + b.getId(),
                "customer", customerName,
                "method", method,
                "gross", "৳" + gross.intValue(),
                "fee", "৳" + fee.intValue(),
                "net", "৳" + net.intValue(),
                "status", Map.of("tone", tone, "text", status),
                "shift", isManual ? "Shift 1 · Walk-in" : "Shift 1 · Online"
            ));
        }

        Map<String, Object> result = new HashMap<>();
        result.put("configuredSports", configuredSports);
        result.put("sports", configuredSports);
        result.put("kpis", kpis);
        result.put("reconciliation", reconciliation);
        result.put("chartData", chartData);
        result.put("sportReport", sportReport);
        result.put("methodSplit", methodSplit);
        result.put("ledger", ledger);
        return result;
    }

    private Map<String, Object> emptySummary() {
        return Map.of(
            "configuredSports", List.of(),
            "sports", List.of(),
            "kpis", List.of(),
            "reconciliation", Map.of(
                "onlineMatched", "৳0 · auto-matched ✓ (0 txns)",
                "cashCollected", "৳0 (0 txns)",
                "depositsOutstanding", "৳0",
                "unmatchedIncoming", "৳0 (0)",
                "drawerStatus", "No venues or pitches configured"
            ),
            "chartData", Map.of("labels", List.of(), "datasets", Map.of()),
            "sportReport", List.of(),
            "methodSplit", List.of(),
            "ledger", List.of()
        );
    }

    private String getSportEmoji(String name) {
        if (name == null) return "⚽";
        return switch (name.toLowerCase()) {
            case "cricket" -> "🏏";
            case "badminton" -> "🏸";
            case "futsal" -> "🥅";
            case "volleyball" -> "🏐";
            case "basketball" -> "🏀";
            case "tennis" -> "🎾";
            default -> "⚽";
        };
    }

    private String getSportColor(String name) {
        if (name == null) return "#06B6D4";
        return switch (name.toLowerCase()) {
            case "cricket" -> "#E879F9";
            case "badminton" -> "#FB923C";
            case "futsal" -> "#A3E635";
            case "volleyball" -> "#F472B6";
            default -> "#06B6D4";
        };
    }

    /** Share of a total as a CSS width, or 0% when there is nothing to divide. */
    private String barWidth(BigDecimal part, BigDecimal total) {
        if (total == null || total.signum() <= 0 || part == null) {
            return "0%";
        }
        return part.multiply(BigDecimal.valueOf(100))
                .divide(total, 0, RoundingMode.HALF_UP)
                .intValue() + "%";
    }
}
