package com.turfchai.booking.dto.response;

import com.turfchai.booking.entity.MemberPaymentStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShareDetailsResponse {

    private String shareToken;
    private Long memberId;
    private BigDecimal shareAmount;
    private MemberPaymentStatus paymentStatus;

    private Long bookingId;
    private String bookingCode;
    private String venueName;
    private String venueAddress;
    private String venueArea;
    private String pitchName;
    private LocalDate bookingDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private String hostName;

    private BigDecimal totalBookingAmount;
    private Integer totalPlayers;
    private Integer paidCount;
    private OffsetDateTime splitDeadline;
    private Boolean isExpired;
}
