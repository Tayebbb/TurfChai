package com.turfchai.booking.repository;

import com.turfchai.booking.entity.BookingMember;
import com.turfchai.booking.entity.MemberPaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingMemberRepository extends JpaRepository<BookingMember, Long> {

    List<BookingMember> findByBookingIdOrderByIdAsc(Long bookingId);

    Optional<BookingMember> findByShareToken(String shareToken);

    long countByBookingIdAndPaymentStatus(Long bookingId, MemberPaymentStatus paymentStatus);

    void deleteByBookingId(Long bookingId);
}
