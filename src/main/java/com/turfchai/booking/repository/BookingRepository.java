package com.turfchai.booking.repository;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    List<Booking> findByUserId(Long userId);

    /** An existing pending attempt for this user+slot — payment retries reuse it instead of duplicating. */
    Optional<Booking> findBySlotIdAndUserIdAndStatus(Long slotId, Long userId, BookingStatus status);

    /** Other live bookings on the same slot — used to decide whether cancelling may release it. */
    List<Booking> findBySlotIdAndStatusNot(Long slotId, BookingStatus status);

    List<Booking> findByVenueIdIn(List<Long> venueIds);
    List<Booking> findByVenueIdInOrderByCreatedAtDesc(List<Long> venueIds);
    List<Booking> findByVenueIdInAndBookingDate(List<Long> venueIds, java.time.LocalDate bookingDate);
    List<Booking> findTop5ByVenueIdInOrderByCreatedAtDesc(List<Long> venueIds);
    List<Booking> findByVenueIdInAndBookingDateGreaterThanEqual(List<Long> venueIds, java.time.LocalDate bookingDate);

    /** Distinct bookers active on or after a date — the numerator of the return rate. */
    @Query("SELECT DISTINCT b.userId FROM Booking b WHERE b.bookingDate >= :since")
    List<Long> findDistinctUserIdsBookingSince(@Param("since") java.time.LocalDate since);
}
