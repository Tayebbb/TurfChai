package com.turfchai.pricing.api;

import com.turfchai.pricing.dto.PricingQuoteRequest;
import com.turfchai.pricing.dto.PricingQuoteResponse;
import com.turfchai.pricing.service.PricingInferenceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
public class PricingRestController {

    private final PricingInferenceService pricingInferenceService;

    /**
     * No try/catch here on purpose. Swallowing every exception into an empty
     * 500 turned a missing field into an unexplained server error and logged
     * nothing; the global handler now maps bad input to 400 with the offending
     * field and model outages to 503, and logs what actually failed.
     */
    @PostMapping("/quote")
    public ResponseEntity<PricingQuoteResponse> getQuote(@Valid @RequestBody PricingQuoteRequest request) {
        return ResponseEntity.ok(pricingInferenceService.getQuote(request));
    }
}
