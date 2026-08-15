package com.turfchai.payment.api;

import com.turfchai.payment.service.OwnerPaymentService;
import com.turfchai.security.UserPrincipal;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/owner/payments")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
public class OwnerPaymentRestController {

    private final OwnerPaymentService ownerPaymentService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> getPaymentSummary(
            @AuthenticationPrincipal UserPrincipal principal,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "daily") String timeframe) {
        return ResponseEntity.ok(ownerPaymentService.getPaymentSummary(principal.getId(), timeframe));
    }

    @PostMapping("/close-shift")
    public ResponseEntity<Void> closeShift(
            @AuthenticationPrincipal UserPrincipal principal) {
        // Mock shift closing
        return ResponseEntity.ok().build();
    }
}
