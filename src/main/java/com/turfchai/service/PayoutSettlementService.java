package com.turfchai.service;

import com.turfchai.model.Payout;
import com.turfchai.repository.PayoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PayoutSettlementService {

    private final PayoutRepository payoutRepository;
    private final NotificationService notificationService;

    // ponytail: hardcoded 6% platform fee. ceiling: configurable per-venue fee tiers
    private static final BigDecimal PLATFORM_FEE_RATE = new BigDecimal("0.06");

    @Transactional(readOnly = true)
    public List<Payout> listPayouts(String status) {
        if (status == null || status.isBlank()) {
            return payoutRepository.findAllByOrderByCreatedAtDesc();
        }
        return payoutRepository.findByStatusOrderByCreatedAtDesc(status.toUpperCase());
    }

    @Transactional(readOnly = true)
    public Payout getByCode(String payoutCode) {
        return payoutRepository.findByPayoutCode(payoutCode)
                .orElseThrow(() -> new IllegalArgumentException("Payout not found: " + payoutCode));
    }

    @Transactional
    public void settle(String payoutCode, Long adminUserId) {
        Payout payout = getByCode(payoutCode);

        if (!"PENDING".equals(payout.getStatus())) {
            throw new IllegalStateException("Only PENDING payouts can be settled. Current status: " + payout.getStatus());
        }

        if (Boolean.TRUE.equals(payout.getAnomalyFlag())) {
            throw new IllegalStateException("Cannot settle a flagged payout.");
        }

        // Apply platform fee on settlement if not already applied
        if (payout.getPlatformFee().compareTo(BigDecimal.ZERO) == 0) {
            BigDecimal fee = payout.getGrossAmount().multiply(PLATFORM_FEE_RATE);
            payout.setPlatformFee(fee);
            payout.setNetAmount(payout.getGrossAmount().subtract(fee));
        }

        payout.setStatus("SETTLED");
        payout.setSettledAt(OffsetDateTime.now());
        payout.setSettledBy(adminUserId);
        payoutRepository.save(payout);

        notificationService.send(payout.getOwnerUserId(), "PAYMENT", 
                "Payout Settled", 
                "Your payout of " + payout.getNetAmount() + " " + payout.getCurrency() + " has been settled.", 
                "/owner/payments");
    }

    @Transactional
    public void flag(String payoutCode, String reason, Long adminUserId) {
        Payout payout = getByCode(payoutCode);
        
        payout.setAnomalyFlag(true);
        payout.setAnomalyReason(reason);
        payout.setStatus("FLAGGED");
        payoutRepository.save(payout);

        notificationService.send(payout.getOwnerUserId(), "SYSTEM", 
                "Payout Flagged", 
                "Your payout " + payoutCode + " is under review. Reason: " + reason, 
                "/owner/payments");
    }
}
