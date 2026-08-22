package com.turfchai.booking.dto.response;

import com.turfchai.booking.entity.MemberPaymentStatus;
import com.turfchai.payment.entity.PaymentMethod;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingMemberResponse {

    private Long id;
    private Long bookingId;
    private Long userId;
    private String userName;
    private BigDecimal shareAmount;
    private MemberPaymentStatus paymentStatus;
    private PaymentMethod paymentMethod;
    private Boolean isCaptain;
    private String shareToken;
    private OffsetDateTime paidAt;
    private OffsetDateTime createdAt;
}
