package com.turfchai.booking.repository;

import com.turfchai.booking.entity.Booking;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    List<Booking> findByUserId(Long userId);

    @org.springframework.data.jpa.repository.Query("SELECT b FROM Booking b JOIN Venue v ON b.venueId = v.id WHERE v.owner.id = :ownerId")
    List<Booking> findBookingsByOwnerId(@org.springframework.data.repository.query.Param("ownerId") Long ownerId);
}
