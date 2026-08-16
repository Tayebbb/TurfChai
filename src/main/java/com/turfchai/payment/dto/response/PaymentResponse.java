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
    /**
     * True when this row is the wallet-credit leg of a split payment rather than
     * money owed to the venue. Without it a client cannot tell the two legs apart
     * and may quote the wrong amount as due.
     */
    private Boolean fromWallet;
    private OffsetDateTime paidAt;
    private OffsetDateTime createdAt;
}
