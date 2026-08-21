package com.turfchai.venue.service;

import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.SlotRepository;
import com.turfchai.venue.dto.owner.ManualBookingRequestDto;
import com.turfchai.venue.dto.owner.OwnerCalendarDto;
import com.turfchai.venue.dto.owner.CreatePitchRequest;
import com.turfchai.venue.dto.owner.CreateVenueRequest;
import com.turfchai.venue.dto.owner.UpdatePitchRequest;
import com.turfchai.venue.dto.owner.UpdateVenueRequest;
import com.turfchai.venue.dto.owner.UpsertPricingRuleRequest;
import com.turfchai.venue.dto.owner.VenueManagementDto;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Sport;
import com.turfchai.venue.entity.SportPricingRule;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.SportPricingRuleRepository;
import com.turfchai.venue.repository.SportRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Objects;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Handles all owner-side venue management: create, update, pitches, pricing
 * rules.
 * The player-facing read path lives in {@link VenueSearchService}.
 */
@Service
@Transactional
public class VenueManagementService {

    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");

    /** Mirrors ck_venues_cancel / ck_venues_deposit in V1__baseline.sql. */
    private static final java.util.Set<String> ALLOWED_CANCEL_POLICIES = java.util.Set.of("FREE_24H_50_6H",
            "FLEXIBLE_6H", "STRICT_NO_REFUND");
    private static final java.util.Set<String> ALLOWED_DEPOSIT_POLICIES = java.util.Set.of("FULL_ONLY",
            "THIRTY_PERCENT", "FIFTY_PERCENT");

    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final SportRepository sportRepository;
    private final SportPricingRuleRepository pricingRuleRepository;
    private final UserRepository userRepository;
    private final SlotRepository slotRepository;
    private final com.turfchai.repository.TurfRequestRepository turfRequestRepository;
    private final BookingRepository bookingRepository;
    private final com.turfchai.booking.service.SlotTimePolicy slotTimePolicy;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.turfchai.pricing.service.PricingInferenceService pricingInferenceService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SlotPricingRuleEngine pricingEngine;

    public VenueManagementService(VenueRepository venueRepository,
            PitchRepository pitchRepository,
            SportRepository sportRepository,
            SportPricingRuleRepository pricingRuleRepository,
            UserRepository userRepository,
            SlotRepository slotRepository,
            com.turfchai.repository.TurfRequestRepository turfRequestRepository,
            BookingRepository bookingRepository,
            com.turfchai.booking.service.SlotTimePolicy slotTimePolicy) {
        this.venueRepository = venueRepository;
        this.pitchRepository = pitchRepository;
        this.sportRepository = sportRepository;
        this.pricingRuleRepository = pricingRuleRepository;
        this.userRepository = userRepository;
        this.slotRepository = slotRepository;
        this.turfRequestRepository = turfRequestRepository;
        this.bookingRepository = bookingRepository;
        this.slotTimePolicy = slotTimePolicy;
    }

    // ── Venue ──────────────────────────────────────────────────────────────

    /** Create a new venue owned by the given user. */
    /** Create a new venue or update existing venue for the owner. */
    public VenueManagementDto createVenue(Long ownerUserId, CreateVenueRequest req) {
        User owner = userRepository.findById(ownerUserId)
                .orElseThrow(() -> new IllegalArgumentException("Owner not found"));

        List<Venue> existing = venueRepository.findByOwnerId(ownerUserId);
        Venue venue = existing.isEmpty() ? new Venue() : existing.get(0);
        if (venue.getId() == null) {
            venue.setOwner(owner);
            venue.setSlug(generateUniqueSlug(req.name()));
            venue.setVenueCode(generateVenueCode());
        }
        venue.setName(req.name());
        if (req.address() != null && !req.address().isBlank())
            venue.setAddress(req.address());
        if (req.area() != null && !req.area().isBlank())
            venue.setArea(req.area());
        if (req.lat() != null)
            venue.setLat(req.lat());
        if (req.lng() != null)
            venue.setLng(req.lng());
        if (req.basePrice() != null)
            venue.setBasePrice(req.basePrice());
        if (req.openTime() != null)
            venue.setOpenTime(parseTime(req.openTime()));
        if (req.closeTime() != null)
            venue.setCloseTime(parseTime(req.closeTime()));
        if (req.amenities() != null)
            venue.setAmenities(req.amenities());
        if (req.contactPhone() != null)
            venue.setContactPhone(req.contactPhone());
        if (req.contactEmail() != null)
            venue.setContactEmail(req.contactEmail());
        if (req.depositPolicy() != null)
            venue.setDepositPolicy(validDepositPolicy(req.depositPolicy()));
        if (req.cancelPolicy() != null)
            venue.setCancelPolicy(validCancelPolicy(req.cancelPolicy()));
        if (req.allowSplitPayment() != null)
            venue.setAllowSplitPayment(req.allowSplitPayment());
        if (req.rules() != null)
            venue.setRules(req.rules());
        if (req.photos() != null && !req.photos().isEmpty())
            venue.setPhotos(String.join(",", req.photos()));
        if (req.mlPricingEnabled() != null)
            venue.setMlPricingEnabled(req.mlPricingEnabled());

        var requests = (turfRequestRepository != null)
                ? turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId)
                : List.<com.turfchai.model.TurfRequest>of();
        if (!requests.isEmpty() && "APPROVED".equalsIgnoreCase(requests.get(0).getStatus())) {
            venue.setVerified(true);
            if ("DRAFT".equalsIgnoreCase(venue.getStatus()) || "PENDING".equalsIgnoreCase(venue.getStatus())) {
                venue.setStatus("PENDING_LISTING");
            }
        } else if (venue.getId() == null) {
            venue.setStatus("DRAFT");
        }

        Venue saved = venueRepository.save(venue);
        return toDto(saved);
    }

    /**
     * List all venues owned by the given user.
     *
     * <p>
     * This used to invent a venue when the owner had none: "Kick Off Arena"
     * in Dhanmondi at 23.8103/90.4125, ৳2000, "floodlights,parking". A brand-new
     * owner who had created nothing was shown a turf they did not own, at an
     * address that was not theirs. A venue is created in exactly one place -
     * {@code TurfApprovalService} when an admin approves the owner's turf
     * request - so an owner with no approved request correctly has none.
     */
    @Transactional
    public List<VenueManagementDto> listOwnerVenues(Long ownerUserId) {
        if (ownerUserId == null) {
            return List.of();
        }
        User owner = userRepository.findById(ownerUserId).orElse(null);
        List<Venue> venues = venueRepository.findByOwnerId(ownerUserId);
        var requests = (turfRequestRepository != null)
                ? turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId)
                : List.<com.turfchai.model.TurfRequest>of();
        if (requests.isEmpty() && owner != null && owner.getEmail() != null) {
            requests = turfRequestRepository.findByOwnerEmailOrderByCreatedAtDesc(owner.getEmail());
        }
        boolean isApproved = !requests.isEmpty() && "APPROVED".equalsIgnoreCase(requests.get(0).getStatus());
        boolean isRejected = !requests.isEmpty() && "REJECTED".equalsIgnoreCase(requests.get(0).getStatus());

        for (Venue v : venues) {
            boolean updated = false;
            if (isApproved) {
                if (!v.isVerified()) {
                    v.setVerified(true);
                    updated = true;
                }
                if ("DRAFT".equalsIgnoreCase(v.getStatus()) || "PENDING".equalsIgnoreCase(v.getStatus())) {
                    v.setStatus("PENDING_LISTING");
                    updated = true;
                }
            } else if (isRejected && !"REJECTED".equalsIgnoreCase(v.getStatus())) {
                v.setStatus("REJECTED");
                updated = true;
            }
            if (updated) {
                venueRepository.save(v);
            }
        }
        return venues.stream().map(this::toDto).toList();
    }

    /** Get a single venue owned by the given user (throws if not owner). */
    @Transactional
    public VenueManagementDto getOwnerVenue(Long ownerUserId, Long venueId) {
        Venue venue = requireOwnership(ownerUserId, venueId);
        User owner = userRepository.findById(ownerUserId).orElse(null);
        var requests = turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId);
        if (requests.isEmpty() && owner != null && owner.getEmail() != null) {
            requests = turfRequestRepository.findByOwnerEmailOrderByCreatedAtDesc(owner.getEmail());
        }
        if (!requests.isEmpty()) {
            String reqStatus = requests.get(0).getStatus();
            if ("APPROVED".equalsIgnoreCase(reqStatus)) {
                boolean updated = false;
                if (!venue.isVerified()) {
                    venue.setVerified(true);
                    updated = true;
                }
                if ("DRAFT".equalsIgnoreCase(venue.getStatus()) || "PENDING".equalsIgnoreCase(venue.getStatus())) {
                    venue.setStatus("PENDING_LISTING");
                    updated = true;
                }
                if (updated) {
                    venue = venueRepository.save(venue);
                }
            } else if ("REJECTED".equalsIgnoreCase(reqStatus) && !"REJECTED".equalsIgnoreCase(venue.getStatus())) {
                venue.setStatus("REJECTED");
                venue = venueRepository.save(venue);
            }
        }
        return toDto(venue);
    }

    /** Update venue fields — only non-null values in the request are applied. */
    public VenueManagementDto updateVenue(Long ownerUserId, Long venueId, UpdateVenueRequest req) {
        Venue venue = requireOwnership(ownerUserId, venueId);

        if (req.name() != null)
            venue.setName(req.name());
        if (req.address() != null)
            venue.setAddress(req.address());
        if (req.area() != null)
            venue.setArea(req.area());
        if (req.lat() != null)
            venue.setLat(req.lat());
        if (req.lng() != null)
            venue.setLng(req.lng());
        if (req.openTime() != null)
            venue.setOpenTime(parseTime(req.openTime()));
        if (req.closeTime() != null)
            venue.setCloseTime(parseTime(req.closeTime()));
        if (req.amenities() != null)
            venue.setAmenities(req.amenities());
        if (req.contactPhone() != null)
            venue.setContactPhone(req.contactPhone());
        if (req.contactEmail() != null)
            venue.setContactEmail(req.contactEmail());
        if (req.depositPolicy() != null)
            venue.setDepositPolicy(validDepositPolicy(req.depositPolicy()));
        if (req.cancelPolicy() != null)
            venue.setCancelPolicy(validCancelPolicy(req.cancelPolicy()));
        if (req.allowSplitPayment() != null)
            venue.setAllowSplitPayment(req.allowSplitPayment());
        if (req.rules() != null)
            venue.setRules(req.rules());
        if (req.status() != null)
            venue.setStatus(req.status());
        if (req.hasPromotion() != null)
            venue.setHasPromotion(req.hasPromotion());
        if (req.promotionLabel() != null)
            venue.setPromotionLabel(req.promotionLabel());
        if (req.photos() != null)
            venue.setPhotos(String.join(",", req.photos()));
        if (req.mlPricingEnabled() != null) {
            boolean wasEnabled = venue.isMlPricingEnabled();
            boolean isNowEnabled = req.mlPricingEnabled();
            venue.setMlPricingEnabled(isNowEnabled);
            if (wasEnabled != isNowEnabled) {
                repriceUpcomingSlots(venue, isNowEnabled);
            }
        }
        if (req.basePrice() != null)
            venue.setBasePrice(req.basePrice());

        return toDto(venueRepository.save(venue));
    }

    /**
     * Reprices all upcoming AVAILABLE slots for the venue according to ML model (if enabled)
     * or standard pricing rules / base price (if disabled).
     * Past slots and already booked / held slots stay completely untouched.
     */
    public void repriceUpcomingSlots(Venue venue, boolean enableMlPricing) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        List<Slot> upcomingSlots = slotRepository.findUpcomingAvailableSlots(venue.getId(), today, now);
        if (upcomingSlots == null || upcomingSlots.isEmpty()) {
            return;
        }

        for (Slot slot : upcomingSlots) {
            try {
                String sportSlug = "football";
                if (slot.getPitch() != null && slot.getPitch().getSports() != null && !slot.getPitch().getSports().isEmpty()) {
                    sportSlug = slot.getPitch().getSports().iterator().next().getSlug();
                }

                final String sportSlugFinal = sportSlug;
                if (enableMlPricing && pricingInferenceService != null) {
                    java.time.LocalDateTime dt = java.time.LocalDateTime.of(slot.getSlotDate(), slot.getStartTime());
                    long daysBefore = java.time.temporal.ChronoUnit.DAYS.between(today, slot.getSlotDate());
                    com.turfchai.pricing.dto.PricingQuoteRequest quoteReq = new com.turfchai.pricing.dto.PricingQuoteRequest();
                    quoteReq.setVenueId(venue.getId());
                    quoteReq.setSportSlug(sportSlugFinal);
                    quoteReq.setBookingDateTime(dt);
                    quoteReq.setDaysBeforeBooking((int) Math.max(0, daysBefore));
                    quoteReq.setOccupancyRate(0.5f);

                    com.turfchai.pricing.dto.PricingQuoteResponse quote = pricingInferenceService.getQuote(quoteReq);
                    if (quote != null && quote.getSuggestedPrice() > 0) {
                        BigDecimal roundedPrice = BigDecimal.valueOf(Math.round(quote.getSuggestedPrice() / 50.0) * 50.0)
                                .setScale(2, java.math.RoundingMode.HALF_UP);
                        slot.setPrice(roundedPrice);
                    }
                } else {
                    boolean hasMatchingRule = venue.getPricingRules() != null && venue.getPricingRules().stream()
                            .anyMatch(r -> r.isActive() && r.getSport() != null
                                    && r.getSport().getSlug().equalsIgnoreCase(sportSlugFinal));

                    if (hasMatchingRule && pricingEngine != null) {
                        try {
                            com.turfchai.venue.dto.owner.SlotPriceResponse priceRes = pricingEngine.calculate(
                                    venue.getId(),
                                    sportSlugFinal,
                                    slot.getSlotDate(),
                                    slot.getStartTime(),
                                    slot.getEndTime()
                            );
                            if (priceRes != null && priceRes.totalPrice() != null) {
                                slot.setPrice(priceRes.totalPrice());
                            } else {
                                setSlotFallbackPrice(slot, venue);
                            }
                        } catch (Exception ignored) {
                            setSlotFallbackPrice(slot, venue);
                        }
                    } else {
                        setSlotFallbackPrice(slot, venue);
                    }
                }
            } catch (Exception e) {
                // Continue to next slot
            }
        }
        slotRepository.saveAll(upcomingSlots);
    }

    private void setSlotFallbackPrice(Slot slot, Venue venue) {
        if (venue.getBasePrice() != null && venue.getBasePrice().compareTo(BigDecimal.ZERO) > 0) {
            slot.setPrice(venue.getBasePrice());
        } else if (slot.getPrice() == null || slot.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            slot.setPrice(BigDecimal.valueOf(2000.00).setScale(2, java.math.RoundingMode.HALF_UP));
        }
    }

    // ── Pitches ────────────────────────────────────────────────────────────

    /** Add a pitch to the venue. */
    public VenueManagementDto.PitchDto addPitch(Long ownerUserId, Long venueId, CreatePitchRequest req) {
        Venue venue = requireOwnership(ownerUserId, venueId);

        String pitchName = (req.name() != null && !req.name().isBlank()) ? req.name().trim() : "New Pitch";
        int counter = 2;
        String baseName = pitchName;
        while (pitchRepository.existsByVenueIdAndName(venueId, pitchName)) {
            pitchName = baseName + " " + counter++;
        }

        Pitch pitch = new Pitch();
        pitch.setName(pitchName);
        pitch.setFormat(req.format() != null ? req.format() : "7_a_side");
        pitch.setSurfaceType(req.surfaceType() != null ? req.surfaceType() : "Artificial grass");
        pitch.setSurfaceDetail(req.surfaceDetail() != null ? req.surfaceDetail() : "Standard synthetic turf");
        pitch.setDimensions(req.dimensions() != null ? req.dimensions() : "30×50 m");
        pitch.setLighting(req.lighting() != null ? req.lighting() : "Full LED floodlights");
        pitch.setMaxPlayers(req.maxPlayers() != null ? req.maxPlayers() : 14);
        pitch.setIndoor(req.indoor());
        pitch.setActive(true);

        if (req.sportSlugs() != null && !req.sportSlugs().isEmpty()) {
            req.sportSlugs().forEach(slug -> sportRepository.findBySlug(slug.toLowerCase(Locale.ROOT))
                    .ifPresent(pitch.getSports()::add));
        }
        if (pitch.getSports().isEmpty()) {
            sportRepository.findBySlug("football").ifPresent(pitch.getSports()::add);
        }

        venue.addPitch(pitch);
        venueRepository.save(venue);
        return toPitchDto(pitch);
    }

    /** Update an existing pitch. */
    public VenueManagementDto.PitchDto updatePitch(Long ownerUserId, Long venueId,
            Long pitchId, UpdatePitchRequest req) {
        requireOwnership(ownerUserId, venueId);
        Pitch pitch = pitchRepository.findById(pitchId)
                .filter(p -> p.getVenue().getId().equals(venueId))
                .orElseThrow(() -> new IllegalArgumentException("Pitch not found: " + pitchId));

        if (req.name() != null)
            pitch.setName(req.name());
        if (req.format() != null)
            pitch.setFormat(req.format());
        if (req.surfaceType() != null)
            pitch.setSurfaceType(req.surfaceType());
        if (req.surfaceDetail() != null)
            pitch.setSurfaceDetail(req.surfaceDetail());
        if (req.dimensions() != null)
            pitch.setDimensions(req.dimensions());
        if (req.lighting() != null)
            pitch.setLighting(req.lighting());
        if (req.maxPlayers() != null)
            pitch.setMaxPlayers(req.maxPlayers());
        if (req.indoor() != null)
            pitch.setIndoor(req.indoor());
        if (req.active() != null)
            pitch.setActive(req.active());
        if (req.sportSlugs() != null) {
            pitch.getSports().clear();
            req.sportSlugs().forEach(slug -> sportRepository.findBySlug(slug).ifPresent(pitch.getSports()::add));
        }

        return toPitchDto(pitchRepository.save(pitch));
    }

    /** Soft-delete (deactivate) a pitch. */
    public void deactivatePitch(Long ownerUserId, Long venueId, Long pitchId) {
        requireOwnership(ownerUserId, venueId);
        Pitch pitch = pitchRepository.findById(pitchId)
                .filter(p -> p.getVenue().getId().equals(venueId))
                .orElseThrow(() -> new IllegalArgumentException("Pitch not found: " + pitchId));
        pitch.setActive(false);
        pitchRepository.save(pitch);
    }

    // ── Pricing Rules
    // ────────────────────────────────────────────────────────────────

    /**
     * Upsert a pricing rule for a (venue, sport, windowType) combination.
     * If a rule already exists for that combination, it is updated; otherwise
     * created.
     */
    public VenueManagementDto.PricingRuleDto upsertPricingRule(Long ownerUserId, Long venueId,
            UpsertPricingRuleRequest req) {
        if (!req.windowEnd().isAfter(req.windowStart())) {
            throw new IllegalArgumentException("windowEnd must be after windowStart");
        }

        requireOwnership(ownerUserId, venueId);
        Venue venue = venueRepository.findById(venueId).orElseThrow();
        Sport sport = sportRepository.findBySlug(req.sportSlug())
                .orElseThrow(() -> new IllegalArgumentException("Sport not found: " + req.sportSlug()));

        SportPricingRule rule = pricingRuleRepository
                .findByVenueIdAndSportIdAndWindowType(venueId, sport.getId(), req.windowType())
                .orElseGet(() -> {
                    SportPricingRule r = new SportPricingRule();
                    r.setVenue(venue);
                    r.setSport(sport);
                    r.setWindowType(req.windowType());
                    return r;
                });

        rule.setRate(req.rate());
        rule.setSlotDurationMin(req.slotDurationMin());
        rule.setBufferMin(req.bufferMin() != null ? req.bufferMin() : 10);
        rule.setWindowStart(req.windowStart());
        rule.setWindowEnd(req.windowEnd());
        rule.setDaysOfWeek(req.daysOfWeek() != null ? req.daysOfWeek() : List.of(1, 2, 3, 4, 5, 6, 7));
        rule.setActive(true);

        SportPricingRule saved = pricingRuleRepository.save(rule);

        // Keep venue basePrice in sync
        if ("football".equalsIgnoreCase(req.sportSlug()) || venue.getBasePrice() == null) {
            venue.setBasePrice(req.rate());
            venueRepository.save(venue);
        }

        repriceUpcomingSlots(venue);

        return toPricingRuleDto(saved);
    }

    /** Permanently remove a pricing rule. */
    public void deletePricingRule(Long ownerUserId, Long venueId, Long ruleId) {
        requireOwnership(ownerUserId, venueId);
        SportPricingRule rule = pricingRuleRepository.findById(ruleId)
                .filter(r -> r.getVenue().getId().equals(venueId))
                .orElseThrow(() -> new IllegalArgumentException("Pricing rule not found: " + ruleId));
        pricingRuleRepository.delete(rule);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Add a photo URL to the venue photos list */
    public VenueManagementDto addVenuePhoto(Long ownerUserId, Long venueId, String photoUrl) {
        Venue venue = requireOwnership(ownerUserId, venueId);
        String currentPhotos = venue.getPhotos();
        if (currentPhotos == null || currentPhotos.isBlank()) {
            venue.setPhotos(photoUrl);
        } else {
            venue.setPhotos(currentPhotos + "," + photoUrl);
        }
        return toDto(venueRepository.save(venue));
    }

    /** Dedicated method to update venue status (e.g. LIVE / PENDING_LISTING) */
    public VenueManagementDto updateVenueStatus(Long ownerUserId, Long venueId, String status) {
        Venue venue = requireOwnership(ownerUserId, venueId);
        String targetStatus = status;
        if ("OFFLINE".equalsIgnoreCase(status)) {
            targetStatus = "PENDING_LISTING";
        }
        venue.setStatus(targetStatus);
        return toDto(venueRepository.save(venue));
    }

    public Venue requireOwnership(Long ownerUserId, Long venueId) {
        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new com.turfchai.exception.VenueNotFoundException("Venue not found: " + venueId));
        if (venue.getOwner() == null || !venue.getOwner().getId().equals(ownerUserId)) {
            throw new SecurityException("Access denied: you do not own venue " + venueId);
        }
        return venue;
    }

    private String generateUniqueSlug(String name) {
        String base = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        base = NON_ALPHANUMERIC.matcher(base).replaceAll("-")
                .replaceAll("^-|-$", "");
        String slug = base;
        int counter = 2;
        while (venueRepository.existsBySlug(slug)) {
            slug = base + "-" + counter++;
        }
        return slug;
    }

    private String generateVenueCode() {
        long count = venueRepository.count() + 1;
        return "VEN-%04d".formatted(count);
    }

    private static LocalTime parseTime(String hhmm) {
        if (hhmm == null)
            return null;
        String[] parts = hhmm.split(":");
        return LocalTime.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
    }

    /**
     * The two policy columns are constrained to a fixed vocabulary and the
     * refund engine switches on exactly those values. Accepting anything else
     * stored a policy no code path could honour, and the owner screen was
     * sending its own display labels.
     */
    private static String validCancelPolicy(String value) {
        String policy = value == null ? null : value.trim().toUpperCase();
        if (!ALLOWED_CANCEL_POLICIES.contains(policy)) {
            throw new IllegalArgumentException("cancelPolicy must be one of " + ALLOWED_CANCEL_POLICIES);
        }
        return policy;
    }

    private static String validDepositPolicy(String value) {
        String policy = value == null ? null : value.trim().toUpperCase();
        if (!ALLOWED_DEPOSIT_POLICIES.contains(policy)) {
            throw new IllegalArgumentException("depositPolicy must be one of " + ALLOWED_DEPOSIT_POLICIES);
        }
        return policy;
    }

    // ── Mapping ────────────────────────────────────────────────────────────

    private VenueManagementDto toDto(Venue v) {
        boolean isVerified = v.isVerified();
        String status = v.getStatus();

        if (v.getOwner() != null && turfRequestRepository != null) {
            var requests = turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(v.getOwner().getId());
            if (requests.isEmpty() && v.getOwner().getEmail() != null) {
                requests = turfRequestRepository.findByOwnerEmailOrderByCreatedAtDesc(v.getOwner().getEmail());
            }
            if (!requests.isEmpty()) {
                String reqStatus = requests.get(0).getStatus();
                if ("APPROVED".equalsIgnoreCase(reqStatus)) {
                    isVerified = true;
                    if ("DRAFT".equalsIgnoreCase(status) || "PENDING".equalsIgnoreCase(status)) {
                        status = "PENDING_LISTING";
                    }
                } else if ("REJECTED".equalsIgnoreCase(reqStatus)) {
                    status = "REJECTED";
                }
            }
        }

        List<VenueManagementDto.PitchDto> pitches = (v.getPitches() == null)
                ? List.of()
                : v.getPitches().stream().filter(Objects::nonNull).map(this::toPitchDto).toList();

        List<VenueManagementDto.PricingRuleDto> rules = (v.getPricingRules() == null)
                ? List.of()
                : v.getPricingRules().stream().filter(Objects::nonNull).map(this::toPricingRuleDto).toList();

        List<String> photos = (v.getPhotos() == null || v.getPhotos().isBlank() || "[]".equals(v.getPhotos().trim()))
                ? List.of()
                : java.util.Arrays.stream(v.getPhotos().split(","))
                        .filter(p -> !p.trim().isEmpty() && !"[]".equals(p.trim()))
                        .toList();

        return new VenueManagementDto(
                v.getId(), v.getVenueCode(), v.getSlug(), v.getName(), status,
                v.getAddress(), v.getArea(), v.getLat(), v.getLng(),
                v.getOpenTime(), v.getCloseTime(),
                v.getAmenities(), v.getRules(),
                v.getContactPhone(), v.getContactEmail(),
                v.getDepositPolicy(), v.getCancelPolicy(), v.getBasePrice(), v.isAllowSplitPayment(),
                isVerified, v.isTournamentReady(), v.isHasPromotion(), v.getPromotionLabel(),
                v.isMlPricingEnabled(), photos, pitches, rules);
    }

    private VenueManagementDto.PitchDto toPitchDto(Pitch p) {
        List<String> sportSlugs = (p.getSports() == null)
                ? List.of()
                : p.getSports().stream().filter(Objects::nonNull).map(Sport::getSlug).filter(Objects::nonNull).toList();
        return new VenueManagementDto.PitchDto(
                p.getId(), p.getName(), p.getFormat(), p.getSurfaceType(),
                p.getSurfaceDetail(), p.getDimensions(), p.getLighting(),
                p.getMaxPlayers(), p.isIndoor(), p.isActive(), sportSlugs);
    }

    private VenueManagementDto.PricingRuleDto toPricingRuleDto(SportPricingRule r) {
        String sportSlug = (r.getSport() != null) ? r.getSport().getSlug() : "football";
        return new VenueManagementDto.PricingRuleDto(
                r.getId(), sportSlug, r.getWindowType(),
                r.getRate(), r.getSlotDurationMin(), r.getBufferMin(),
                r.getWindowStart(), r.getWindowEnd(), r.getDaysOfWeek(), r.isActive());
    }

    // ── Calendar Grid ──────────────────────────────────────────────────────

    @Transactional
    public OwnerCalendarDto getOwnerCalendar(Long ownerUserId, Long venueId, LocalDate date) {
        List<Venue> userVenues = venueRepository.findByOwnerId(ownerUserId);
        if (userVenues.isEmpty()) {
            return OwnerCalendarDto.builder()
                    .venueId(venueId)
                    .venueName("No Venue")
                    .date(date)
                    .pitches(List.of())
                    .rows(List.of())
                    .build();
        }

        Venue venue = (venueId != null)
                ? userVenues.stream().filter(v -> v.getId().equals(venueId)).findFirst().orElse(userVenues.get(0))
                : userVenues.get(0);

        List<Pitch> pitches = pitchRepository.findByVenueIdAndActiveTrue(venue.getId());
        if (pitches.isEmpty()) {
            pitches = pitchRepository.findByVenueId(venue.getId());
        }

        if (pitches.isEmpty()) {
            return OwnerCalendarDto.builder()
                    .venueId(venue.getId())
                    .venueName(venue.getName())
                    .date(date)
                    .pitches(List.of())
                    .rows(List.of())
                    .build();
        }

        List<Slot> dbSlots = slotRepository.findByVenueIdAndSlotDateOrderByStartTimeAsc(venue.getId(), date);
        if (dbSlots.isEmpty() && !pitches.isEmpty()) {
            dbSlots = seedSlotsForDate(venue.getId(), pitches, date);
        }

        List<OwnerCalendarDto.PitchHeaderDto> pitchHeaders = pitches.stream()
                .map(p -> new OwnerCalendarDto.PitchHeaderDto(
                        p.getId(),
                        p.getName(),
                        p.getFormat() != null ? p.getFormat() : "Standard",
                        p.getSports().stream().map(Sport::getSlug).toList()))
                .toList();

        List<OwnerCalendarDto.TimeRowDto> rows = buildCalendarRowsFromDbSlots(pitchHeaders, dbSlots,
                liveBookingsBySlot(venue.getId(), date));

        return OwnerCalendarDto.builder()
                .venueId(venue.getId())
                .venueName(venue.getName())
                .date(date)
                .pitches(pitchHeaders)
                .rows(rows)
                .build();
    }

    public void blockSlot(Long ownerUserId, Long venueId, Long slotId) {
        if (slotId == null) {
            throw new IllegalArgumentException("Slot ID cannot be null");
        }
        Slot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new IllegalArgumentException("Slot not found: " + slotId));

        Venue venue = venueRepository.findById(slot.getVenueId())
                .orElseThrow(() -> new IllegalArgumentException("Venue not found: " + slot.getVenueId()));

        if (venue.getOwner() == null || !venue.getOwner().getId().equals(ownerUserId)) {
            throw new SecurityException("Access denied: you do not own this slot");
        }

        if (slot.getStatus() == SlotStatus.BOOKED) {
            throw new IllegalArgumentException("Cannot block an already booked slot");
        }

        slot.setStatus(SlotStatus.BLOCKED);
        slotRepository.save(slot);
    }

    public void unblockSlot(Long ownerUserId, Long venueId, Long slotId) {
        if (slotId == null) {
            throw new IllegalArgumentException("Slot ID cannot be null");
        }
        Slot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new IllegalArgumentException("Slot not found: " + slotId));

        Venue venue = venueRepository.findById(slot.getVenueId())
                .orElseThrow(() -> new IllegalArgumentException("Venue not found: " + slot.getVenueId()));

        if (venue.getOwner() == null || !venue.getOwner().getId().equals(ownerUserId)) {
            throw new SecurityException("Access denied: you do not own this slot");
        }

        if (slot.getStatus() != SlotStatus.BLOCKED) {
            throw new IllegalArgumentException("Slot is not currently blocked");
        }

        slot.setStatus(SlotStatus.AVAILABLE);
        slotRepository.save(slot);
    }

    /**
     * Records a walk-in or phone booking the owner took directly.
     *
     * <p>
     * Locks the slot and refuses one that is already taken or has already
     * started. It previously overwrote any slot unconditionally, so a manual
     * booking could silently take a slot a player had already paid for, and could
     * be entered against a match that had already been played.
     */
    public void createManualBooking(Long ownerUserId, Long venueId, ManualBookingRequestDto req) {
        if (req.getSlotId() == null) {
            throw new IllegalArgumentException("Pick a slot to book");
        }
        Slot slot = slotRepository.findByIdForUpdate(req.getSlotId())
                .orElseThrow(() -> new com.turfchai.booking.exception.SlotUnavailableException(
                        "Slot not found with id: " + req.getSlotId()));

        slotTimePolicy.assertNotStarted(slot);

        if (slot.getStatus() == SlotStatus.BOOKED) {
            throw new com.turfchai.booking.exception.SlotUnavailableException(
                    "That slot is already booked");
        }
        if (slot.getStatus() == SlotStatus.BLOCKED) {
            throw new com.turfchai.booking.exception.SlotUnavailableException(
                    "That slot is blocked — unblock it first");
        }

        slot.setStatus(SlotStatus.BOOKED);
        slot.setHeldByUserId(null);
        slot.setHoldExpiresAt(null);
        slotRepository.save(slot);

        BigDecimal amount = (slot.getPrice() != null) ? slot.getPrice() : BigDecimal.ZERO;
        Long targetVenueId = (slot.getVenueId() != null && slot.getVenueId() > 0) ? slot.getVenueId() : venueId;
        if (slot.getPitch() == null) {
            throw new IllegalStateException("Slot " + slot.getId() + " has no pitch and cannot be booked");
        }

        String bookingSource = "PHONE";
        if (req.getSource() != null) {
            String src = req.getSource().trim().toUpperCase();
            if (src.contains("WALK")) {
                bookingSource = "WALK_IN";
            } else if (src.contains("PHONE")) {
                bookingSource = "PHONE";
            } else {
                bookingSource = src;
            }
        }

        bookingRepository.save(Booking.builder()
                .bookingCode("MB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .slot(slot)
                .userId(ownerUserId)
                .guestName(req.getCustomerName())
                .guestPhone(req.getCustomerPhone())
                .source(bookingSource)
                .notes(req.getNotes())
                .venueId(targetVenueId)
                .pitchId(slot.getPitch().getId())
                .bookingDate(slot.getSlotDate())
                .startTime(slot.getStartTime())
                .endTime(slot.getEndTime())
                .grossAmount(amount)
                .netAmount(amount)
                .status(BookingStatus.CONFIRMED)
                .build());
    }

    private List<Slot> seedSlotsForDate(Long venueId, List<Pitch> pitches, LocalDate date) {
        List<SportPricingRule> rules = pricingRuleRepository.findActiveByVenueId(venueId);
        Venue venue = venueRepository.findById(venueId).orElse(null);
        List<Slot> createdSlots = new ArrayList<>();

        for (Pitch p : pitches) {
            // Check if pitch has a matching sport rule
            SportPricingRule matchingRule = null;
            if (p.getSports() != null && !p.getSports().isEmpty()) {
                for (Sport s : p.getSports()) {
                    matchingRule = rules.stream()
                            .filter(r -> r.getSport() != null && r.getSport().getId().equals(s.getId()))
                            .findFirst()
                            .orElse(null);
                    if (matchingRule != null) break;
                }
            }
            if (matchingRule == null && !rules.isEmpty()) {
                matchingRule = rules.get(0);
            }

            int durationMin = (matchingRule != null && matchingRule.getSlotDurationMin() > 0)
                    ? matchingRule.getSlotDurationMin()
                    : 90;
            int bufferMin = (matchingRule != null && matchingRule.getBufferMin() >= 0)
                    ? matchingRule.getBufferMin()
                    : 10;
            BigDecimal price = (matchingRule != null && matchingRule.getRate() != null)
                    ? matchingRule.getRate()
                    : (venue != null && venue.getBasePrice() != null ? venue.getBasePrice() : BigDecimal.valueOf(2000));

            LocalTime startWindow = (matchingRule != null && matchingRule.getWindowStart() != null)
                    ? matchingRule.getWindowStart()
                    : (venue != null && venue.getOpenTime() != null ? venue.getOpenTime() : LocalTime.of(16, 0));
            LocalTime endWindow = (matchingRule != null && matchingRule.getWindowEnd() != null)
                    ? matchingRule.getWindowEnd()
                    : (venue != null && venue.getCloseTime() != null ? venue.getCloseTime() : LocalTime.of(23, 30));

            LocalTime cursor = startWindow;
            while (cursor.isBefore(endWindow)) {
                LocalTime slotEnd = cursor.plusMinutes(durationMin);
                if (slotEnd.isAfter(endWindow) || slotEnd.isBefore(cursor)) {
                    break;
                }
                Slot slot = Slot.builder()
                        .pitch(p)
                        .venueId(venueId)
                        .slotDate(date)
                        .price(price)
                        .startTime(cursor)
                        .endTime(slotEnd)
                        .status(SlotStatus.AVAILABLE)
                        .build();
                createdSlots.add(slotRepository.save(slot));

                // Advance by slot duration + buffer
                cursor = slotEnd.plusMinutes(bufferMin);
            }
        }
        return createdSlots;
    }

    /**
     * Indexes the venue's live (non-cancelled) bookings for a date by slot id, so
     * the
     * calendar can expose the real booking behind each occupied cell.
     */
    private java.util.Map<Long, Booking> liveBookingsBySlot(Long venueId, LocalDate date) {
        java.util.Map<Long, Booking> bySlot = new java.util.HashMap<>();
        for (Booking booking : bookingRepository.findByVenueIdInAndBookingDate(List.of(venueId), date)) {
            if (booking.getStatus() == BookingStatus.CANCELLED || booking.getSlot() == null) {
                continue;
            }
            bySlot.putIfAbsent(booking.getSlot().getId(), booking);
        }
        return bySlot;
    }

    private List<OwnerCalendarDto.TimeRowDto> buildCalendarRowsFromDbSlots(
            List<OwnerCalendarDto.PitchHeaderDto> pitchHeaders,
            List<Slot> dbSlots,
            java.util.Map<Long, Booking> bookingsBySlot) {

        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);

        java.util.Map<String, List<Slot>> timeGroupedMap = dbSlots.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        s -> s.getStartTime().format(timeFormatter),
                        java.util.LinkedHashMap::new,
                        java.util.stream.Collectors.toList()));

        List<OwnerCalendarDto.TimeRowDto> timeRows = new ArrayList<>();

        for (java.util.Map.Entry<String, List<Slot>> entry : timeGroupedMap.entrySet()) {
            String timeLabel = entry.getKey();
            List<Slot> rowSlots = entry.getValue();
            List<OwnerCalendarDto.CellDto> cells = new ArrayList<>();

            for (OwnerCalendarDto.PitchHeaderDto header : pitchHeaders) {
                Slot pitchSlot = rowSlots.stream()
                        .filter(s -> s.getPitch() != null && s.getPitch().getId().equals(header.getId()))
                        .findFirst()
                        .orElse(null);

                String headerSport = (header.getSports() != null && !header.getSports().isEmpty())
                        ? header.getSports().get(0)
                        : "Football";

                if (pitchSlot != null) {
                    String variant = "online";
                    String label = "Available";
                    String kind = "event";
                    boolean openable = true;
                    Booking booking = bookingsBySlot.get(pitchSlot.getId());
                    User customer = booking != null && booking.getUserId() != null
                            ? userRepository.findById(booking.getUserId()).orElse(null)
                            : null;

                    if (pitchSlot.getStatus() == SlotStatus.BOOKED) {
                        variant = "online";
                        label = "Booked · ৳" + (pitchSlot.getPrice() != null ? pitchSlot.getPrice().intValue() : 2000);
                        kind = "event";
                        openable = true;
                    } else if (pitchSlot.getStatus() == SlotStatus.HELD) {
                        variant = "held";
                        label = "Held · checkout";
                        kind = "event";
                        openable = true;
                    } else if (pitchSlot.getStatus() == SlotStatus.BLOCKED) {
                        variant = "blocked";
                        label = "Maintenance";
                        kind = "event";
                        openable = false;
                    } else {
                        kind = "add";
                        variant = "available";
                        label = "Available";
                        openable = true;
                    }

                    String custName = booking != null && booking.getGuestName() != null && !booking.getGuestName().isBlank()
                            ? booking.getGuestName()
                            : (customer != null ? customer.getFullName() : null);
                    String custPhone = booking != null && booking.getGuestPhone() != null && !booking.getGuestPhone().isBlank()
                            ? booking.getGuestPhone()
                            : (customer != null ? customer.getPhone() : null);

                    String startStr = pitchSlot.getStartTime() != null ? pitchSlot.getStartTime().format(timeFormatter) : timeLabel;
                    String endStr = pitchSlot.getEndTime() != null ? pitchSlot.getEndTime().format(timeFormatter) : null;
                    Integer durationMin = null;
                    if (pitchSlot.getStartTime() != null && pitchSlot.getEndTime() != null) {
                        durationMin = (int) java.time.Duration.between(pitchSlot.getStartTime(), pitchSlot.getEndTime()).toMinutes();
                    }

                    cells.add(OwnerCalendarDto.CellDto.builder()
                            .slotId(pitchSlot.getId())
                            .pitchId(header.getId())
                            .kind(kind)
                            .variant(variant)
                            .label(label)
                            .openable(openable)
                            .status(pitchSlot.getStatus().name())
                            .price(pitchSlot.getPrice() != null ? pitchSlot.getPrice().doubleValue() : 2000.0)
                            .startTime(startStr)
                            .endTime(endStr)
                            .durationMinutes(durationMin)
                            .sport(headerSport)
                            .bookingId(booking != null ? booking.getId() : null)
                            .bookingCode(booking != null ? booking.getBookingCode() : null)
                            .customerName(custName)
                            .customerPhone(custPhone)
                            .checkedIn(booking != null && booking.getCheckedInAt() != null)
                            .build());
                } else {
                    cells.add(OwnerCalendarDto.CellDto.builder()
                            .slotId(null)
                            .pitchId(header.getId())
                            .kind("add")
                            .variant("available")
                            .label("Available")
                            .openable(true)
                            .status("AVAILABLE")
                            .price(2000.0)
                            .startTime(timeLabel)
                            .endTime(null)
                            .durationMinutes(90)
                            .sport(headerSport)
                            .build());
                }
            }

            timeRows.add(new OwnerCalendarDto.TimeRowDto(timeLabel, cells));
        }

        return timeRows;
    }
}
