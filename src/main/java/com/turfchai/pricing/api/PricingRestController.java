package com.turfchai.pricing.api;

import com.turfchai.pricing.dto.PricingQuoteRequest;
import com.turfchai.pricing.dto.PricingQuoteResponse;
import com.turfchai.pricing.service.PricingInferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
public class PricingRestController {

    private final PricingInferenceService pricingInferenceService;

    @PostMapping("/quote")
    public ResponseEntity<PricingQuoteResponse> getQuote(@RequestBody PricingQuoteRequest request) {
        try {
            return ResponseEntity.ok(pricingInferenceService.getQuote(request));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
