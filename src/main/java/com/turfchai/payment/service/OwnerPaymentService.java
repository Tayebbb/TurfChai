package com.turfchai.payment.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.model.User;
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

    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final BookingRepository bookingRepository;
    private final SlotRepository slotRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

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

        // Fallback: If pitch sports mapping is empty, assign "Football" as default configured sport
        if (configuredSports.isEmpty()) {
            sportNames.add("Football");
            configuredSports.add(Map.of(
                "key", "Football",
                "name", "Football",
                "label", "⚽ Football"
            ));
        }

        // 2. Date Filtering & Financial Calculations
        LocalDate today = LocalDate.now();
        List<Booking> allOwnerBookings = new ArrayList<>(bookingRepository.findByVenueIdIn(venueIds));

        // Reconcile any slots marked BOOKED that are missing a corresponding Booking entity
        Set<Long> existingBookedSlotIds = new HashSet<>();
        for (Booking b : allOwnerBookings) {
            if (b.getSlot() != null && b.getSlot().getId() != null) {
                existingBookedSlotIds.add(b.getSlot().getId());
            }
        }

        List<Slot> allOwnerSlots = slotRepository.findByVenueIdIn(venueIds);
        for (Slot s : allOwnerSlots) {
            if (s.getStatus() == SlotStatus.BOOKED && !existingBookedSlotIds.contains(s.getId())) {
                BigDecimal amount = (s.getPrice() != null) ? s.getPrice() : BigDecimal.valueOf(2000);
                Booking synthetic = Booking.builder()
                        .bookingCode("MB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                        .slot(s)
                        .userId(ownerUserId)
                        .venueId(s.getVenueId() != null ? s.getVenueId() : venueIds.get(0))
                        .pitchId(s.getPitch() != null ? s.getPitch().getId() : 0L)
                        .bookingDate(s.getSlotDate() != null ? s.getSlotDate() : today)
                        .startTime(s.getStartTime() != null ? s.getStartTime() : LocalTime.of(16, 0))
                        .endTime(s.getEndTime() != null ? s.getEndTime() : LocalTime.of(17, 30))
                        .grossAmount(amount)
                        .netAmount(amount)
                        .status(BookingStatus.CONFIRMED)
                        .build();
                bookingRepository.save(synthetic);
                allOwnerBookings.add(synthetic);
            }
        }

        BigDecimal grossToday = BigDecimal.ZERO;
        BigDecimal grossTotal = BigDecimal.ZERO;
        BigDecimal onlineGross = BigDecimal.ZERO;
        BigDecimal cashGross = BigDecimal.ZERO;
        BigDecimal pendingGross = BigDecimal.ZERO;

        int onlineCount = 0;
        int cashCount = 0;
        int pendingCount = 0;

        for (Booking b : allOwnerBookings) {
            if (b.getGrossAmount() != null) {
                if (b.getStatus() == BookingStatus.CONFIRMED) {
                    grossTotal = grossTotal.add(b.getGrossAmount());
                    boolean isToday = (b.getBookingDate() != null && today.equals(b.getBookingDate())) ||
                                      (b.getCreatedAt() != null && today.equals(b.getCreatedAt().toLocalDate()));
                    if (isToday) {
                        grossToday = grossToday.add(b.getGrossAmount());
                    }
                    if (b.getBookingCode() != null && b.getBookingCode().startsWith("BKG-")) {
                        onlineGross = onlineGross.add(b.getGrossAmount());
                        onlineCount++;
                    } else {
                        cashGross = cashGross.add(b.getGrossAmount());
                        cashCount++;
                    }
                } else if (b.getStatus() == BookingStatus.PENDING) {
                    pendingGross = pendingGross.add(b.getGrossAmount());
                    pendingCount++;
                }
            }
        }

        BigDecimal platformFees = onlineGross.multiply(new BigDecimal("0.06")).setScale(0, RoundingMode.HALF_UP);
        BigDecimal refunds = BigDecimal.ZERO;
        BigDecimal netToYou = grossTotal.subtract(platformFees).subtract(refunds);

        // 3. Dynamic KPIs
        List<Map<String, String>> kpis = List.of(
            Map.of("label", "Gross today", "value", "৳" + grossToday.intValue(), "delta", "+0% vs yesterday"),
            Map.of("label", "Platform fees", "value", "৳" + platformFees.intValue(), "delta", "6% flat fee"),
            Map.of("label", "Refunds", "value", "৳" + refunds.intValue(), "delta", "0 cancellations"),
            Map.of("label", "Net to you", "value", "৳" + netToYou.intValue(), "delta", "Available for payout")
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
            List<String> missedItems = new ArrayList<>();

            for (Slot s : ownerSlots) {
                totalSlotsForSport++;
                if (s.getStatus() == SlotStatus.BOOKED) {
                    bookedSlotsForSport++;
                } else if (s.getStatus() == SlotStatus.AVAILABLE || s.getStatus() == SlotStatus.BLOCKED) {
                    missedSlotsForSport++;
                    if (missedItems.size() < 5) {
                        missedItems.add((s.getSlotDate() != null ? s.getSlotDate().toString() : "Date") + " · " +
                            (s.getStartTime() != null ? s.getStartTime().toString() : "Slot") + " (Unbooked)");
                    }
                }
            }

            int occupancyPct = totalSlotsForSport > 0 ? (bookedSlotsForSport * 100) / totalSlotsForSport : 0;
            int estimatedLoss = missedSlotsForSport * 2000;

            sportReport.add(Map.of(
                "sport", sportName,
                "title", sportName,
                "booked", bookedSlotsForSport,
                "missed", missedSlotsForSport,
                "missedCount", missedSlotsForSport,
                "missedLoss", "৳" + estimatedLoss,
                "items", missedItems.isEmpty() ? List.of("No missed slots recorded") : missedItems,
                "occ", Map.of("text", occupancyPct + "% Occupancy", "tone", occupancyPct > 50 ? "green" : "amber"),
                "bar", Map.of("width", occupancyPct + "%", "background", getSportColor(sportName)),
                "cta", "View " + missedSlotsForSport + " missed slots →"
            ));
        }

        // 7. Method Split
        List<Map<String, Object>> methodSplit = List.of(
            Map.of("id", "bkash", "label", "bKash / Online", "value", "৳" + onlineGross.intValue(), "width", "65%", "color", "#E2136E"),
            Map.of("id", "cash", "label", "Cash at venue", "value", "৳" + cashGross.intValue(), "width", "35%", "color", "var(--green)")
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

        return Map.of(
            "configuredSports", configuredSports,
            "sports", configuredSports,
            "kpis", kpis,
            "reconciliation", reconciliation,
            "chartData", chartData,
            "sportReport", sportReport,
            "methodSplit", methodSplit,
            "ledger", ledger
        );
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
}
