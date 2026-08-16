package com.turfchai.player.service;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.model.User;
import com.turfchai.player.dto.PlayerStatsResponse;
import com.turfchai.repository.OpenGameMembershipRepository;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Derives a player's activity summary from records that already exist.
 *
 * <p>No figure here is estimated or sampled. Match results are deliberately
 * absent: TurfChai records that a pitch was booked and whether the player turned
 * up, never a score, so a "win rate" would have to be invented.
 */
@Service
@RequiredArgsConstructor
public class PlayerStatsService {

    private static final int MONTHS_CHARTED = 6;

    private final BookingRepository bookingRepository;
    private final ReviewRepository reviewRepository;
    private final OpenGameMembershipRepository membershipRepository;
    private final VenueRepository venueRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public PlayerStatsResponse forUser(Long userId) {
        List<Booking> bookings = bookingRepository.findByUserId(userId);
        LocalDate today = LocalDate.now();

        int cancelled = 0;
        int completed = 0;
        int upcoming = 0;
        int checkedIn = 0;
        BigDecimal spent = BigDecimal.ZERO;
        Map<Long, Integer> bookingsPerVenue = new LinkedHashMap<>();
        Map<String, Integer> perMonth = new LinkedHashMap<>();

        for (int i = MONTHS_CHARTED - 1; i >= 0; i--) {
            perMonth.put(YearMonth.from(today).minusMonths(i).toString(), 0);
        }

        for (Booking booking : bookings) {
            boolean isCancelled = booking.getStatus() == BookingStatus.CANCELLED;
            if (isCancelled) {
                cancelled++;
            } else if (booking.getBookingDate() != null && !booking.getBookingDate().isBefore(today)) {
                upcoming++;
            } else {
                completed++;
            }

            if (booking.getCheckedInAt() != null) {
                checkedIn++;
            }
            if (!isCancelled && booking.getNetAmount() != null) {
                spent = spent.add(booking.getNetAmount());
            }
            if (!isCancelled && booking.getVenueId() != null) {
                bookingsPerVenue.merge(booking.getVenueId(), 1, Integer::sum);
            }
            if (booking.getBookingDate() != null) {
                String key = YearMonth.from(booking.getBookingDate()).toString();
                if (perMonth.containsKey(key)) {
                    perMonth.merge(key, 1, Integer::sum);
                }
            }
        }

        String favouriteVenue = bookingsPerVenue.entrySet().stream()
                .max(Comparator.comparingInt(Map.Entry::getValue))
                .flatMap(entry -> venueRepository.findById(entry.getKey()))
                .map(venue -> venue.getName())
                .orElse(null);

        Integer storedReliability = userRepository.findById(userId)
                .map(User::getReliabilityScore)
                .orElse(null);
        int reliability = storedReliability != null ? storedReliability : 100;

        List<PlayerStatsResponse.MonthlyCount> chart = perMonth.entrySet().stream()
                .map(entry -> new PlayerStatsResponse.MonthlyCount(entry.getKey(), entry.getValue()))
                .toList();

        return new PlayerStatsResponse(
                bookings.size(),
                completed,
                cancelled,
                upcoming,
                checkedIn,
                bookingsPerVenue.size(),
                membershipRepository.findByUserId(userId).size(),
                (int) reviewRepository.countByUserId(userId),
                reliability,
                spent,
                favouriteVenue,
                chart);
    }
}
