package com.turfchai.booking.repository;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    List<Booking> findByUserId(Long userId);

    /** An existing pending attempt for this user+slot — payment retries reuse it instead of duplicating. */
    Optional<Booking> findBySlotIdAndUserIdAndStatus(Long slotId, Long userId, BookingStatus status);
}
