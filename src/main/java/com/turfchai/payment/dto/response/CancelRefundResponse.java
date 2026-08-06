package com.turfchai.payment.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CancelRefundResponse {
    private Long bookingId;
    private String bookingStatus;
    private int refundPercent;
    private BigDecimal refundAmount;
    private PaymentResponse refundPayment;
}
