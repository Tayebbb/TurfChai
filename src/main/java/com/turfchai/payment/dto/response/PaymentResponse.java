package com.turfchai.payment.dto.response;

import com.turfchai.payment.entity.PaymentMethod;
import com.turfchai.payment.entity.PaymentStatus;
import com.turfchai.payment.entity.PaymentType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentResponse {
    private Long id;
    private String txnReference;
    private PaymentType type;
    private BigDecimal amount;
    private PaymentMethod method;
    private PaymentStatus status;
    private String failureReason;
    private OffsetDateTime paidAt;
    private OffsetDateTime createdAt;
}
