package com.turfchai.promotion.api;

import com.turfchai.promotion.dto.AppliedDiscountResponse;
import com.turfchai.promotion.dto.AvailablePromoResponse;
import com.turfchai.promotion.dto.CreatePromotionRequest;
import com.turfchai.promotion.dto.PromotionDto;
import com.turfchai.promotion.dto.UpdatePromotionRequest;
import com.turfchai.promotion.dto.ValidatePromoCodeRequest;
import com.turfchai.promotion.service.PromotionService;
import com.turfchai.security.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Promotion REST API.
 *
 * <pre>
 * POST   /api/v1/owner/venues/{venueId}/promotions          — create promo
 * GET    /api/v1/owner/venues/{venueId}/promotions          — list venue promos (owner)
 * PATCH  /api/v1/owner/venues/{venueId}/promotions/{id}     — toggle active / update label
 * DELETE /api/v1/owner/venues/{venueId}/promotions/{id}     — delete
 *
 * POST   /api/v1/promotions/validate-code                   — validate + calculate discount (public)
 * </pre>
 */
@RestController
@RequestMapping("/api/v1")
public class PromotionRestController {

    private final PromotionService promotionService;

    public PromotionRestController(PromotionService promotionService) {
        this.promotionService = promotionService;
    }

    // ── Owner endpoints ────────────────────────────────────────────────────

    @PostMapping("/owner/venues/{venueId}/promotions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
    public PromotionDto createPromotion(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long venueId,
            @Valid @RequestBody CreatePromotionRequest request) {
        return promotionService.createPromotion(principal.getId(), venueId, request);
    }

    @GetMapping("/owner/venues/{venueId}/promotions")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
    public List<PromotionDto> listPromotions(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long venueId) {
        return promotionService.listByVenue(principal.getId(), venueId);
    }

    @PatchMapping("/owner/venues/{venueId}/promotions/{id}")
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
    public PromotionDto updatePromotion(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long venueId,
            @PathVariable Long id,
            @Valid @RequestBody UpdatePromotionRequest request) {
        return promotionService.updatePromotion(principal.getId(), venueId, id, request);
    }

    @DeleteMapping("/owner/venues/{venueId}/promotions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
    public void deletePromotion(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long venueId,
            @PathVariable Long id) {
        promotionService.deletePromotion(principal.getId(), venueId, id);
    }

    // ── Public checkout endpoints ──────────────────────────────────────────

    /**
     * GET /api/v1/venues/{venueId}/promotions/available — every promo code a
     * player could redeem at this venue right now. Public, mirroring
     * {@code /api/v1/venues/{venueId}/slots}: the checkout page lists these
     * when the promo box is clicked, instead of requiring the player to
     * already know a code.
     */
    @GetMapping("/venues/{venueId}/promotions/available")
    public List<AvailablePromoResponse> listAvailablePromos(@PathVariable Long venueId) {
        return promotionService.listAvailableForVenue(venueId);
    }

    @PostMapping("/promotions/validate-code")
    public ResponseEntity<AppliedDiscountResponse> validateCode(
            @Valid @RequestBody ValidatePromoCodeRequest request) {
        AppliedDiscountResponse result = promotionService.validateAndApply(request);
        return result.valid()
                ? ResponseEntity.ok(result)
                : ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(result);
    }
}
