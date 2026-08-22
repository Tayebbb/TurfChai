package com.turfchai.booking.service;

import com.turfchai.booking.dto.request.BookingSplitRequest;
import com.turfchai.booking.dto.request.SharePaymentRequest;
import com.turfchai.booking.dto.response.BookingMemberResponse;
import com.turfchai.booking.dto.response.BookingSplitResponse;
import com.turfchai.booking.dto.response.ShareDetailsResponse;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingMember;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.entity.MemberPaymentStatus;
import com.turfchai.booking.repository.BookingMemberRepository;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.exception.BookingNotFoundException;
import com.turfchai.model.User;
import com.turfchai.payment.entity.Payment;
import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.entity.PaymentStatus;
import com.turfchai.payment.entity.PaymentType;
import com.turfchai.payment.repository.PaymentRepository;
import com.turfchai.repository.UserRepository;
import com.turfchai.service.NotificationService;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingSplitService {

    private static final Logger log = LoggerFactory.getLogger(BookingSplitService.class);

    private final BookingRepository bookingRepository;
    private final BookingMemberRepository bookingMemberRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final NotificationService notificationService;

    @Transactional
    public BookingSplitResponse enableSplit(Long bookingId, BookingSplitRequest request, Long userId) {
        return enableSplit(bookingId, request, userId, PaymentMethod.BKASH, null);
    }

    @Transactional
    public BookingSplitResponse enableSplit(Long bookingId, BookingSplitRequest request, Long userId, PaymentMethod method) {
        return enableSplit(bookingId, request, userId, method, null);
    }

    @Transactional
    public BookingSplitResponse enableSplit(Long bookingId, BookingSplitRequest request, Long userId, PaymentMethod method, BigDecimal customTotalAmount) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException("Booking not found with id: " + bookingId));

        if (!booking.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not own this booking");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot split a cancelled booking");
        }

        int playerCount = request.getPlayerCount();
        BigDecimal netAmount = customTotalAmount != null ? customTotalAmount : booking.getNetAmount();
        if (netAmount == null || netAmount.compareTo(BigDecimal.ZERO) <= 0) {
            netAmount = booking.getGrossAmount() != null ? booking.getGrossAmount() : BigDecimal.ZERO;
        }

        BigDecimal baseShare = netAmount.divide(BigDecimal.valueOf(playerCount), 2, RoundingMode.HALF_UP);
        // Remainder adjustment for exact sum
        BigDecimal totalCalculated = baseShare.multiply(BigDecimal.valueOf(playerCount));
        BigDecimal captainShare = baseShare.add(netAmount.subtract(totalCalculated));

        // Deadline is min(now + 24 hours, kickoff start time)
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime kickoff = booking.getBookingDate().atTime(booking.getStartTime()).atOffset(ZoneOffset.UTC);
        OffsetDateTime in24Hours = now.plusHours(24);
        OffsetDateTime deadline = kickoff.isBefore(in24Hours) ? kickoff : in24Hours;

        booking.setSplitEnabled(true);
        booking.setSplitDeadline(deadline);
        booking.setSplitTotalPaid(captainShare);
        booking.setSplitRemaining(netAmount.subtract(captainShare));
        bookingRepository.save(booking);

        // Remove old members if re-splitting
        bookingMemberRepository.deleteByBookingId(bookingId);

        List<BookingMember> createdMembers = new ArrayList<>();

        // Captain row
        BookingMember captain = BookingMember.builder()
                .bookingId(bookingId)
                .userId(userId)
                .shareAmount(captainShare)
                .paymentStatus(MemberPaymentStatus.PAID)
                .paymentMethod(method != null ? method : PaymentMethod.BKASH)
                .isCaptain(true)
                .paidAt(now)
                .shareToken(generateShareToken())
                .build();
        createdMembers.add(bookingMemberRepository.save(captain));

        // Other players
        for (int i = 1; i < playerCount; i++) {
            BookingMember member = BookingMember.builder()
                    .bookingId(bookingId)
                    .shareAmount(baseShare)
                    .paymentStatus(MemberPaymentStatus.PENDING)
                    .isCaptain(false)
                    .shareToken(generateShareToken())
                    .build();
            createdMembers.add(bookingMemberRepository.save(member));
        }

        return toSplitResponse(booking, createdMembers);
    }

    @Transactional
    public BookingSplitResponse getSplitStatus(Long bookingId, Long userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new BookingNotFoundException("Booking not found with id: " + bookingId));

        if (!booking.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to view this booking's split");
        }

        List<BookingMember> members = bookingMemberRepository.findByBookingIdOrderByIdAsc(bookingId);

        // Check if deadline passed and there are pending members
        if (Boolean.TRUE.equals(booking.getSplitEnabled()) && booking.getSplitDeadline() != null) {
            if (OffsetDateTime.now().isAfter(booking.getSplitDeadline())) {
                long pendingCount = members.stream()
                        .filter(m -> m.getPaymentStatus() == MemberPaymentStatus.PENDING)
                        .count();
                if (pendingCount > 0) {
                    notificationService.sendOnce(
                            booking.getUserId(),
                            "SPLIT_DEADLINE_PASSED",
                            "Split payment deadline reached for " + booking.getBookingCode(),
                            "Your 24-hour split deadline has passed with " + pendingCount + " unpaid spot(s). " +
                                    "Please pay the remaining ৳" + booking.getSplitRemaining() + " within 1 hour, post an open game, or cancel the booking.",
                            "/player/bookings/" + booking.getId()
                    );
                }
            }
        }

        return toSplitResponse(booking, members);
    }

    @Transactional(readOnly = true)
    public ShareDetailsResponse getShareDetails(String shareToken) {
        BookingMember member = bookingMemberRepository.findByShareToken(shareToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid share link or QR code"));

        Booking booking = bookingRepository.findById(member.getBookingId())
                .orElseThrow(() -> new BookingNotFoundException("Booking not found with id: " + member.getBookingId()));

        Venue venue = venueRepository.findById(booking.getVenueId()).orElse(null);
        Pitch pitch = pitchRepository.findById(booking.getPitchId()).orElse(null);
        User host = userRepository.findById(booking.getUserId()).orElse(null);

        List<BookingMember> allMembers = bookingMemberRepository.findByBookingIdOrderByIdAsc(booking.getId());
        int paidCount = (int) allMembers.stream().filter(m -> m.getPaymentStatus() == MemberPaymentStatus.PAID).count();

        boolean isExpired = booking.getStatus() == BookingStatus.CANCELLED ||
                (booking.getSplitDeadline() != null && OffsetDateTime.now().isAfter(booking.getSplitDeadline()));

        String hostName = host != null ? (host.getFullName() != null && !host.getFullName().isBlank() ? host.getFullName() : host.getEmail()) : "Host";

        return ShareDetailsResponse.builder()
                .shareToken(member.getShareToken())
                .memberId(member.getId())
                .shareAmount(member.getShareAmount())
                .paymentStatus(member.getPaymentStatus())
                .bookingId(booking.getId())
                .bookingCode(booking.getBookingCode())
                .venueName(venue != null ? venue.getName() : "Turf Venue")
                .venueAddress(venue != null ? venue.getAddress() : "")
                .venueArea(venue != null ? venue.getArea() : "")
                .pitchName(pitch != null ? pitch.getName() : "Main Pitch")
                .bookingDate(booking.getBookingDate())
                .startTime(booking.getStartTime())
                .endTime(booking.getEndTime())
                .hostName(hostName)
                .totalBookingAmount(booking.getNetAmount())
                .totalPlayers(allMembers.isEmpty() ? 1 : allMembers.size())
                .paidCount(paidCount)
                .splitDeadline(booking.getSplitDeadline())
                .isExpired(isExpired)
                .build();
    }

    @Transactional
    public ShareDetailsResponse completeSharePayment(String shareToken, SharePaymentRequest request) {
        BookingMember member = bookingMemberRepository.findByShareToken(shareToken)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invalid share link or QR code"));

        if (member.getPaymentStatus() == MemberPaymentStatus.PAID) {
            return getShareDetails(shareToken);
        }

        Booking booking = bookingRepository.findById(member.getBookingId())
                .orElseThrow(() -> new BookingNotFoundException("Booking not found with id: " + member.getBookingId()));

        if (booking.getStatus() == BookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This booking has been cancelled");
        }

        OffsetDateTime now = OffsetDateTime.now();
        member.setPaymentStatus(MemberPaymentStatus.PAID);
        member.setPaymentMethod(request.getPaymentMethod());
        member.setPaidAt(now);
        bookingMemberRepository.save(member);

        // Record payment in payments table
        String txnRef = "SP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Payment payment = Payment.builder()
                .txnReference(txnRef)
                .userId(booking.getUserId())
                .bookingId(booking.getId())
                .bookingMemberId(member.getId())
                .type(PaymentType.SPLIT_SHARE)
                .amount(member.getShareAmount())
                .currency("BDT")
                .method(request.getPaymentMethod())
                .provider("TurfChai Gateway")
                .status(PaymentStatus.SUCCESS)
                .paidAt(now)
                .build();
        paymentRepository.save(payment);

        // Update booking split progress
        BigDecimal newPaid = (booking.getSplitTotalPaid() != null ? booking.getSplitTotalPaid() : BigDecimal.ZERO)
                .add(member.getShareAmount());
        BigDecimal newRemaining = booking.getNetAmount().subtract(newPaid);
        if (newRemaining.compareTo(BigDecimal.ZERO) < 0) {
            newRemaining = BigDecimal.ZERO;
        }
        booking.setSplitTotalPaid(newPaid);
        booking.setSplitRemaining(newRemaining);
        bookingRepository.save(booking);

        // Notify host
        String payer = (request.getPayerName() != null && !request.getPayerName().isBlank())
                ? request.getPayerName() : "A player";
        notificationService.send(
                booking.getUserId(),
                "SPLIT_SHARE_PAID",
                "Share payment received 🎉",
                payer + " paid their ৳" + member.getShareAmount() + " share for booking " + booking.getBookingCode(),
                "/player/bookings/" + booking.getId()
        );

        // Check if all paid
        List<BookingMember> allMembers = bookingMemberRepository.findByBookingIdOrderByIdAsc(booking.getId());
        boolean allPaid = allMembers.stream().allMatch(m -> m.getPaymentStatus() == MemberPaymentStatus.PAID);
        if (allPaid) {
            notificationService.send(
                    booking.getUserId(),
                    "SPLIT_FULLY_PAID",
                    "Split complete! All players have paid 🥳",
                    "All " + allMembers.size() + " shares for booking " + booking.getBookingCode() + " are settled.",
                    "/player/bookings/" + booking.getId()
            );
        }

        return getShareDetails(shareToken);
    }

    private BookingSplitResponse toSplitResponse(Booking booking, List<BookingMember> members) {
        int paidCount = 0;
        int pendingCount = 0;
        List<BookingMemberResponse> memberResponses = new ArrayList<>();

        for (BookingMember m : members) {
            if (m.getPaymentStatus() == MemberPaymentStatus.PAID) {
                paidCount++;
            } else {
                pendingCount++;
            }

            String userName = null;
            if (m.getUserId() != null) {
                User u = userRepository.findById(m.getUserId()).orElse(null);
                if (u != null) {
                    userName = u.getFullName() != null && !u.getFullName().isBlank() ? u.getFullName() : u.getEmail();
                }
            }

            memberResponses.add(BookingMemberResponse.builder()
                    .id(m.getId())
                    .bookingId(m.getBookingId())
                    .userId(m.getUserId())
                    .userName(userName)
                    .shareAmount(m.getShareAmount())
                    .paymentStatus(m.getPaymentStatus())
                    .paymentMethod(m.getPaymentMethod())
                    .isCaptain(m.getIsCaptain())
                    .shareToken(m.getShareToken())
                    .paidAt(m.getPaidAt())
                    .createdAt(m.getCreatedAt())
                    .build());
        }

        BigDecimal shareAmount = members.isEmpty() ? BigDecimal.ZERO : members.get(0).getShareAmount();

        return BookingSplitResponse.builder()
                .bookingId(booking.getId())
                .splitEnabled(booking.getSplitEnabled())
                .splitDeadline(booking.getSplitDeadline())
                .totalAmount(booking.getNetAmount())
                .splitTotalPaid(booking.getSplitTotalPaid())
                .splitRemaining(booking.getSplitRemaining())
                .totalPlayers(members.size())
                .paidCount(paidCount)
                .pendingCount(pendingCount)
                .shareAmount(shareAmount)
                .members(memberResponses)
                .openGameId(booking.getOpenGameId())
                .build();
    }

    private String generateShareToken() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}
