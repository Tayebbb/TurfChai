package com.turfchai.payment.dto.request;

import com.turfchai.payment.entity.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** POST /api/v1/payments/checkout — pay for the caller's currently held slot. */
@Getter
@Setter
public class CheckoutRequest {

    @NotNull(message = "slotId is required")
    private Long slotId;

    @NotNull(message = "method is required")
    private PaymentMethod method;

    /** Wallet balance to apply toward this booking; capped server-side at the balance and the price. */
    @DecimalMin(value = "0", message = "applyWalletAmount must not be negative")
    private BigDecimal applyWalletAmount;

    /** Dev/demo only — deliberately forces a declined payment (wires the "Simulate failed payment" UI). */
    private boolean simulateFailure;
}
