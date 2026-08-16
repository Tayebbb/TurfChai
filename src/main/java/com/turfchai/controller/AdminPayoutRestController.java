package com.turfchai.controller;

import com.turfchai.dto.response.PayoutResponse;
import com.turfchai.model.Payout;
import com.turfchai.service.PayoutSettlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/payouts")
@RequiredArgsConstructor
public class AdminPayoutRestController {

    private final PayoutSettlementService payoutSettlementService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public List<PayoutResponse> listPayouts(@RequestParam(required = false) String status) {
        return payoutSettlementService.listPayouts(status).stream().map(PayoutResponse::from).toList();
    }

    /**
     * Totals only. The dashboard used to fetch every settled payout — 175 KB on
     * a demo database — purely to add up one column in the browser.
     */
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public Map<String, Object> payoutSummary() {
        return payoutSettlementService.summarise();
    }

    @GetMapping("/{code}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public PayoutResponse getPayout(@PathVariable String code) {
        return PayoutResponse.from(payoutSettlementService.getByCode(code));
    }

    @PostMapping("/{code}/settle")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public void settlePayout(@PathVariable String code,
            @AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        payoutSettlementService.settle(code, userDetails.getId());
    }

    @PostMapping("/{code}/flag")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public void flagPayout(@PathVariable String code,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        String reason = payload.get("reason");
        payoutSettlementService.flag(code, reason, userDetails.getId());
    }
}
