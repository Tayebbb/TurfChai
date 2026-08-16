package com.turfchai.promotion.service;

import com.turfchai.promotion.dto.AppliedDiscountResponse;
import com.turfchai.promotion.dto.AvailablePromoResponse;
import com.turfchai.promotion.dto.CreatePromotionRequest;
import com.turfchai.promotion.dto.PromotionDto;
import com.turfchai.promotion.dto.ValidatePromoCodeRequest;
import com.turfchai.promotion.entity.Promotion;
import com.turfchai.promotion.repository.PromotionRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Handles promotion lifecycle and discount calculation.
 *
 * <p>
 * Discount math:
 * <ul>
 * <li>PERCENT: discount = orderTotal × (discountValue / 100), capped by
 * maxDiscountAmount</li>
 * <li>FLAT: discount = discountValue (capped at orderTotal)</li>
 * </ul>
 */
@Service
@Transactional
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final VenueRepository venueRepository;

    public PromotionService(PromotionRepository promotionRepository,
            VenueRepository venueRepository) {
        this.promotionRepository = promotionRepository;
        this.venueRepository = venueRepository;
    }

    // ── Owner CRUD ─────────────────────────────────────────────────────────

    /** Create a new promo code for the given venue. */
    public PromotionDto createPromotion(Long ownerUserId, Long venueId, CreatePromotionRequest req) {
        Venue venue = requireOwnership(ownerUserId, venueId);

        if (promotionRepository.existsByVenueIdAndCode(venueId, req.code().toUpperCase())) {
            throw new IllegalArgumentException("Promo code '" + req.code() + "' already exists for this venue");
        }

        Promotion promo = new Promotion();
        promo.setVenue(venue);
        promo.setCode(req.code().toUpperCase().strip());
        promo.setLabel(req.label());
        promo.setDiscountType(req.discountType());
        promo.setDiscountValue(req.discountValue());
        promo.setMinOrderAmount(req.minOrderAmount() != null ? req.minOrderAmount() : BigDecimal.ZERO);
        promo.setMaxDiscountAmount(req.maxDiscountAmount());
        promo.setConditions(req.conditions() != null ? req.conditions() : "{}");
        // No start date given means "live now". Truncate to the second so the
        // timestamp column cannot round the start forward past the clock and
        // refuse the code the owner just published.
        promo.setValidFrom(req.validFrom() != null
                ? req.validFrom()
                : Instant.now().truncatedTo(ChronoUnit.SECONDS));
        promo.setValidUntil(req.validUntil());
        promo.setUsageLimit(req.usageLimit());
        promo.setActive(true);

        return toDto(promotionRepository.save(promo));
    }

    /** List all promotions for a venue (owner view — includes inactive). */
    @Transactional(readOnly = true)
    public List<PromotionDto> listByVenue(Long ownerUserId, Long venueId) {
        requireOwnership(ownerUserId, venueId);
        return promotionRepository.findByVenueId(venueId).stream()
                .map(this::toDto)
                .toList();
    }

    /** Applies a partial update. Absent fields are left as they are. */
    public PromotionDto updatePromotion(Long ownerUserId, Long venueId, Long promoId,
            com.turfchai.promotion.dto.UpdatePromotionRequest request) {
        requireOwnership(ownerUserId, venueId);
        Promotion promo = promotionRepository.findById(promoId)
                .filter(p -> p.getVenue().getId().equals(venueId))
                .orElseThrow(() -> new IllegalArgumentException("Promotion not found: " + promoId));

        if (request.active() != null)
            promo.setActive(request.active());
        if (request.label() != null && !request.label().isBlank())
            promo.setLabel(request.label());
        if (request.discountType() != null)
            promo.setDiscountType(request.discountType());
        if (request.discountValue() != null)
            promo.setDiscountValue(request.discountValue());
        if (request.minOrderAmount() != null)
            promo.setMinOrderAmount(request.minOrderAmount());
        if (request.maxDiscountAmount() != null)
            promo.setMaxDiscountAmount(request.maxDiscountAmount());
        if (request.validFrom() != null)
            promo.setValidFrom(request.validFrom());
        if (request.validUntil() != null)
            promo.setValidUntil(request.validUntil());
        if (request.usageLimit() != null)
            promo.setUsageLimit(request.usageLimit());

        return toDto(promotionRepository.save(promo));
    }

    /** Hard-delete a promotion. */
    public void deletePromotion(Long ownerUserId, Long venueId, Long promoId) {
        requireOwnership(ownerUserId, venueId);
        Promotion promo = promotionRepository.findById(promoId)
                .filter(p -> p.getVenue().getId().equals(venueId))
                .orElseThrow(() -> new IllegalArgumentException("Promotion not found: " + promoId));
        promotionRepository.delete(promo);
    }

    /**
     * Codes a player could redeem at this venue right now — what the checkout
     * page's promo box lists when clicked. Public, like {@code validate-code}:
     * a code being run is not sensitive, and the player still has to type or
     * pick it before it applies to anything.
     */
    @Transactional(readOnly = true)
    public List<AvailablePromoResponse> listAvailableForVenue(Long venueId) {
        return promotionRepository.findAvailableForVenue(venueId, Instant.now()).stream()
                .map(p -> new AvailablePromoResponse(
                        p.getCode(), p.getLabel(), p.getDiscountType(), p.getDiscountValue(),
                        p.getMinOrderAmount(), p.getMaxDiscountAmount()))
                .toList();
    }

    // ── Public validate & apply ────────────────────────────────────────────

    /**
     * Validate a promo code and calculate the discount for the given order total.
     * This endpoint is public (no auth required) so the checkout UI can call it.
     */
    @Transactional(readOnly = true)
    public AppliedDiscountResponse validateAndApply(ValidatePromoCodeRequest req) {
        String code = req.code().toUpperCase().strip();
        BigDecimal orderTotal = req.orderTotal();

        // Codes are unique per venue, not globally, so two venues may both run
        // "SAVE20". Scope the lookup to the venue being booked when we know it;
        // a global lookup picked an arbitrary row and could refuse a code the
        // venue genuinely offers.
        Promotion promo = req.venueId() != null
                ? promotionRepository.findByVenueIdAndCode(req.venueId(), code).orElse(null)
                : promotionRepository.findByCodeAndActiveTrue(code).orElse(null);

        if (promo == null) {
            return AppliedDiscountResponse.invalid(code, orderTotal, "Invalid or expired promo code");
        }
        if (!promo.isActive()) {
            return AppliedDiscountResponse.invalid(code, orderTotal, "Invalid or expired promo code");
        }

        // Scope check: if venueId provided, must match
        if (req.venueId() != null && !promo.getVenue().getId().equals(req.venueId())) {
            return AppliedDiscountResponse.invalid(code, orderTotal, "Promo code not valid for this venue");
        }

        // Time window
        Instant now = Instant.now();
        if (now.isBefore(promo.getValidFrom())) {
            return AppliedDiscountResponse.invalid(code, orderTotal, "Promo code is not yet active");
        }
        if (promo.getValidUntil() != null && now.isAfter(promo.getValidUntil())) {
            return AppliedDiscountResponse.invalid(code, orderTotal, "Promo code has expired");
        }

        // Usage limit
        if (promo.getUsageLimit() != null && promo.getUsageCount() >= promo.getUsageLimit()) {
            return AppliedDiscountResponse.invalid(code, orderTotal, "Promo code usage limit reached");
        }

        // Minimum order check
        if (orderTotal.compareTo(promo.getMinOrderAmount()) < 0) {
            return AppliedDiscountResponse.invalid(code, orderTotal,
                    "Minimum order amount is ৳" + promo.getMinOrderAmount().toPlainString());
        }

        // Calculate discount
        BigDecimal discountAmount = calculateDiscount(promo, orderTotal);
        BigDecimal finalTotal = orderTotal.subtract(discountAmount).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        return new AppliedDiscountResponse(
                promo.getCode(),
                promo.getLabel(),
                promo.getDiscountType(),
                promo.getDiscountValue(),
                orderTotal,
                discountAmount,
                finalTotal,
                true,
                "Promo applied successfully");
    }

    /**
     * Records one redemption, under a row lock so a usage limit cannot be
     * overshot by concurrent checkouts. Returns false when the promotion has
     * been exhausted or paused since it was quoted, which the caller must treat
     * as "the discount no longer applies".
     */
    public boolean recordUsage(Long venueId, String code) {
        if (code == null || code.isBlank() || venueId == null) {
            return false;
        }
        return promotionRepository.findByVenueAndCodeForUpdate(venueId, code.strip())
                .map(promo -> {
                    if (!promo.isActive()) {
                        return false;
                    }
                    if (promo.getUsageLimit() != null && promo.getUsageCount() >= promo.getUsageLimit()) {
                        return false;
                    }
                    promo.setUsageCount(promo.getUsageCount() + 1);
                    // Auto-deactivate if limit reached
                    if (promo.getUsageLimit() != null && promo.getUsageCount() >= promo.getUsageLimit()) {
                        promo.setActive(false);
                    }
                    promotionRepository.save(promo);
                    return true;
                })
                .orElse(false);
    }

    /**
     * Hands a redemption back when the booking that used it is cancelled, so a
     * cancelled booking does not permanently consume one of a limited run. A
     * promotion that its own limit had deactivated becomes usable again.
     */
    public void releaseUsage(Long venueId, String code) {
        if (code == null || code.isBlank() || venueId == null) {
            return;
        }
        promotionRepository.findByVenueAndCodeForUpdate(venueId, code.strip()).ifPresent(promo -> {
            if (promo.getUsageCount() <= 0) {
                return;
            }
            boolean wasAtLimit = promo.getUsageLimit() != null
                    && promo.getUsageCount() >= promo.getUsageLimit();
            promo.setUsageCount(promo.getUsageCount() - 1);
            if (wasAtLimit) {
                promo.setActive(true);
            }
            promotionRepository.save(promo);
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private BigDecimal calculateDiscount(Promotion promo, BigDecimal orderTotal) {
        BigDecimal discount;
        if ("PERCENT".equals(promo.getDiscountType())) {
            discount = orderTotal
                    .multiply(promo.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            // Apply cap
            if (promo.getMaxDiscountAmount() != null) {
                discount = discount.min(promo.getMaxDiscountAmount());
            }
        } else {
            // FLAT
            discount = promo.getDiscountValue().min(orderTotal);
        }
        return discount.setScale(2, RoundingMode.HALF_UP);
    }

    private Venue requireOwnership(Long ownerUserId, Long venueId) {
        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new IllegalArgumentException("Venue not found: " + venueId));
        if (venue.getOwner() == null || !venue.getOwner().getId().equals(ownerUserId)) {
            throw new SecurityException("Access denied: you do not own venue " + venueId);
        }
        return venue;
    }

    private PromotionDto toDto(Promotion p) {
        return new PromotionDto(
                p.getId(), p.getVenue().getId(), p.getCode(), p.getLabel(),
                p.getDiscountType(), p.getDiscountValue(), p.getMinOrderAmount(),
                p.getMaxDiscountAmount(), p.getConditions(),
                p.getValidFrom(), p.getValidUntil(), p.getUsageLimit(),
                p.getUsageCount(), p.isActive());
    }
}
