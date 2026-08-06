package com.turfchai.venue.service;

import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
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
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Handles all owner-side venue management: create, update, pitches, pricing rules.
 * The player-facing read path lives in {@link VenueSearchService}.
 */
@Service
@Transactional
public class VenueManagementService {

    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");

    private final VenueRepository venueRepository;
    private final PitchRepository pitchRepository;
    private final SportRepository sportRepository;
    private final SportPricingRuleRepository pricingRuleRepository;
    private final UserRepository userRepository;

    public VenueManagementService(VenueRepository venueRepository,
                                   PitchRepository pitchRepository,
                                   SportRepository sportRepository,
                                   SportPricingRuleRepository pricingRuleRepository,
                                   UserRepository userRepository) {
        this.venueRepository = venueRepository;
        this.pitchRepository = pitchRepository;
        this.sportRepository = sportRepository;
        this.pricingRuleRepository = pricingRuleRepository;
        this.userRepository = userRepository;
    }

    // ── Venue ──────────────────────────────────────────────────────────────

    /** Create a new venue owned by the given user. */
    public VenueManagementDto createVenue(Long ownerUserId, CreateVenueRequest req) {
        User owner = userRepository.findById(ownerUserId)
                .orElseThrow(() -> new IllegalArgumentException("Owner not found"));

        Venue venue = new Venue();
        venue.setOwner(owner);
        venue.setName(req.name());
        venue.setSlug(generateUniqueSlug(req.name()));
        venue.setVenueCode(generateVenueCode());
        venue.setAddress(req.address());
        venue.setArea(req.area());
        venue.setLat(req.lat());
        venue.setLng(req.lng());
        venue.setOpenTime(parseTime(req.openTime()));
        venue.setCloseTime(parseTime(req.closeTime()));
        venue.setAmenities(req.amenities());
        venue.setContactPhone(req.contactPhone());
        venue.setContactEmail(req.contactEmail());
        venue.setDepositPolicy(req.depositPolicy() != null ? req.depositPolicy() : "FULL_ONLY");
        venue.setCancelPolicy(req.cancelPolicy() != null ? req.cancelPolicy() : "FREE_24H_50_6H");
        venue.setAllowSplitPayment(req.allowSplitPayment() != null ? req.allowSplitPayment() : true);
        venue.setRules(req.rules());
        venue.setPhotos(req.photos() != null ? String.join(",", req.photos()) : "");
        venue.setStatus("DRAFT");

        Venue saved = venueRepository.save(venue);
        return toDto(saved);
    }

    /** List all venues owned by the given user. */
    @Transactional(readOnly = true)
    public List<VenueManagementDto> listOwnerVenues(Long ownerUserId) {
        return venueRepository.findByOwnerId(ownerUserId).stream()
                .map(this::toDto)
                .toList();
    }

    /** Get a single venue owned by the given user (throws if not owner). */
    @Transactional(readOnly = true)
    public VenueManagementDto getOwnerVenue(Long ownerUserId, Long venueId) {
        Venue venue = requireOwnership(ownerUserId, venueId);
        return toDto(venue);
    }

    /** Update venue fields — only non-null values in the request are applied. */
    public VenueManagementDto updateVenue(Long ownerUserId, Long venueId, UpdateVenueRequest req) {
        Venue venue = requireOwnership(ownerUserId, venueId);

        if (req.name() != null) venue.setName(req.name());
        if (req.address() != null) venue.setAddress(req.address());
        if (req.area() != null) venue.setArea(req.area());
        if (req.lat() != null) venue.setLat(req.lat());
        if (req.lng() != null) venue.setLng(req.lng());
        if (req.openTime() != null) venue.setOpenTime(parseTime(req.openTime()));
        if (req.closeTime() != null) venue.setCloseTime(parseTime(req.closeTime()));
        if (req.amenities() != null) venue.setAmenities(req.amenities());
        if (req.contactPhone() != null) venue.setContactPhone(req.contactPhone());
        if (req.contactEmail() != null) venue.setContactEmail(req.contactEmail());
        if (req.depositPolicy() != null) venue.setDepositPolicy(req.depositPolicy());
        if (req.cancelPolicy() != null) venue.setCancelPolicy(req.cancelPolicy());
        if (req.allowSplitPayment() != null) venue.setAllowSplitPayment(req.allowSplitPayment());
        if (req.rules() != null) venue.setRules(req.rules());
        if (req.status() != null) venue.setStatus(req.status());
        if (req.hasPromotion() != null) venue.setHasPromotion(req.hasPromotion());
        if (req.promotionLabel() != null) venue.setPromotionLabel(req.promotionLabel());
        if (req.photos() != null) venue.setPhotos(String.join(",", req.photos()));

        return toDto(venueRepository.save(venue));
    }

    // ── Pitches ────────────────────────────────────────────────────────────

    /** Add a pitch to the venue. */
    public VenueManagementDto.PitchDto addPitch(Long ownerUserId, Long venueId, CreatePitchRequest req) {
        Venue venue = requireOwnership(ownerUserId, venueId);

        Pitch pitch = new Pitch();
        pitch.setName(req.name());
        pitch.setFormat(req.format());
        pitch.setSurfaceType(req.surfaceType());
        pitch.setSurfaceDetail(req.surfaceDetail());
        pitch.setDimensions(req.dimensions());
        pitch.setLighting(req.lighting());
        pitch.setMaxPlayers(req.maxPlayers() != null ? req.maxPlayers() : 10);
        pitch.setIndoor(req.indoor());
        pitch.setActive(true);

        if (req.sportSlugs() != null) {
            req.sportSlugs().forEach(slug ->
                    sportRepository.findBySlug(slug).ifPresent(pitch.getSports()::add));
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

        if (req.name() != null) pitch.setName(req.name());
        if (req.format() != null) pitch.setFormat(req.format());
        if (req.surfaceType() != null) pitch.setSurfaceType(req.surfaceType());
        if (req.surfaceDetail() != null) pitch.setSurfaceDetail(req.surfaceDetail());
        if (req.dimensions() != null) pitch.setDimensions(req.dimensions());
        if (req.lighting() != null) pitch.setLighting(req.lighting());
        if (req.maxPlayers() != null) pitch.setMaxPlayers(req.maxPlayers());
        if (req.indoor() != null) pitch.setIndoor(req.indoor());
        if (req.active() != null) pitch.setActive(req.active());
        if (req.sportSlugs() != null) {
            pitch.getSports().clear();
            req.sportSlugs().forEach(slug ->
                    sportRepository.findBySlug(slug).ifPresent(pitch.getSports()::add));
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

    // ── Pricing Rules ──────────────────────────────────────────────────────

    /**
     * Upsert a pricing rule for a (venue, sport, windowType) combination.
     * If a rule already exists for that combination, it is updated; otherwise created.
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
        rule.setDaysOfWeek(req.daysOfWeek() != null ? req.daysOfWeek() : List.of(1,2,3,4,5,6,7));
        rule.setActive(true);

        return toPricingRuleDto(pricingRuleRepository.save(rule));
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

    private Venue requireOwnership(Long ownerUserId, Long venueId) {
        Venue venue = venueRepository.findById(venueId)
                .orElseThrow(() -> new IllegalArgumentException("Venue not found: " + venueId));
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
        if (hhmm == null) return null;
        String[] parts = hhmm.split(":");
        return LocalTime.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
    }

    // ── Mapping ────────────────────────────────────────────────────────────

    private VenueManagementDto toDto(Venue v) {
        List<VenueManagementDto.PitchDto> pitches = v.getPitches().stream()
                .map(this::toPitchDto).toList();
        List<VenueManagementDto.PricingRuleDto> rules = v.getPricingRules().stream()
                .map(this::toPricingRuleDto).toList();

        List<String> photos = (v.getPhotos() == null || v.getPhotos().isBlank())
                ? List.of()
                : List.of(v.getPhotos().split(","));

        return new VenueManagementDto(
                v.getId(), v.getVenueCode(), v.getSlug(), v.getName(), v.getStatus(),
                v.getAddress(), v.getArea(), v.getLat(), v.getLng(),
                v.getOpenTime(), v.getCloseTime(),
                v.getAmenities(), v.getRules(),
                v.getContactPhone(), v.getContactEmail(),
                v.getDepositPolicy(), v.getCancelPolicy(), v.isAllowSplitPayment(),
                v.isVerified(), v.isTournamentReady(), v.isHasPromotion(), v.getPromotionLabel(),
                photos, pitches, rules
        );
    }

    private VenueManagementDto.PitchDto toPitchDto(Pitch p) {
        List<String> sportSlugs = p.getSports().stream()
                .map(Sport::getSlug).toList();
        return new VenueManagementDto.PitchDto(
                p.getId(), p.getName(), p.getFormat(), p.getSurfaceType(),
                p.getSurfaceDetail(), p.getDimensions(), p.getLighting(),
                p.getMaxPlayers(), p.isIndoor(), p.isActive(), sportSlugs
        );
    }

    private VenueManagementDto.PricingRuleDto toPricingRuleDto(SportPricingRule r) {
        return new VenueManagementDto.PricingRuleDto(
                r.getId(), r.getSport().getSlug(), r.getWindowType(),
                r.getRate(), r.getSlotDurationMin(), r.getBufferMin(),
                r.getWindowStart(), r.getWindowEnd(), r.getDaysOfWeek(), r.isActive()
        );
    }
}
