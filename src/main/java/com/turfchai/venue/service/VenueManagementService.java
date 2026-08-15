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
    private final SlotRepository slotRepository;
    private final com.turfchai.repository.TurfRequestRepository turfRequestRepository;
    private final BookingRepository bookingRepository;

    public VenueManagementService(VenueRepository venueRepository,
                                   PitchRepository pitchRepository,
                                   SportRepository sportRepository,
                                   SportPricingRuleRepository pricingRuleRepository,
                                   UserRepository userRepository,
                                   SlotRepository slotRepository,
                                   com.turfchai.repository.TurfRequestRepository turfRequestRepository,
                                   BookingRepository bookingRepository) {
        this.venueRepository = venueRepository;
        this.pitchRepository = pitchRepository;
        this.sportRepository = sportRepository;
        this.pricingRuleRepository = pricingRuleRepository;
        this.userRepository = userRepository;
        this.slotRepository = slotRepository;
        this.turfRequestRepository = turfRequestRepository;
        this.bookingRepository = bookingRepository;
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
        if (req.address() != null && !req.address().isBlank()) venue.setAddress(req.address());
        if (req.area() != null && !req.area().isBlank()) venue.setArea(req.area());
        if (req.lat() != null) venue.setLat(req.lat());
        if (req.lng() != null) venue.setLng(req.lng());
        if (req.basePrice() != null) venue.setBasePrice(req.basePrice());
        if (req.openTime() != null) venue.setOpenTime(parseTime(req.openTime()));
        if (req.closeTime() != null) venue.setCloseTime(parseTime(req.closeTime()));
        if (req.amenities() != null) venue.setAmenities(req.amenities());
        if (req.contactPhone() != null) venue.setContactPhone(req.contactPhone());
        if (req.contactEmail() != null) venue.setContactEmail(req.contactEmail());
        if (req.depositPolicy() != null) venue.setDepositPolicy(req.depositPolicy());
        if (req.cancelPolicy() != null) venue.setCancelPolicy(req.cancelPolicy());
        if (req.allowSplitPayment() != null) venue.setAllowSplitPayment(req.allowSplitPayment());
        if (req.rules() != null) venue.setRules(req.rules());
        if (req.photos() != null && !req.photos().isEmpty()) venue.setPhotos(String.join(",", req.photos()));
        if (req.mlPricingEnabled() != null) venue.setMlPricingEnabled(req.mlPricingEnabled());

        var requests = (turfRequestRepository != null) ? turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId) : List.<com.turfchai.model.TurfRequest>of();
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

    /** List all venues owned by the given user (auto-creates a draft venue if owner has none). */
    @Transactional
    public List<VenueManagementDto> listOwnerVenues(Long ownerUserId) {
        List<Venue> venues = venueRepository.findByOwnerId(ownerUserId);
        var requests = (turfRequestRepository != null) ? turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId) : List.<com.turfchai.model.TurfRequest>of();
        boolean isApproved = !requests.isEmpty() && "APPROVED".equalsIgnoreCase(requests.get(0).getStatus());
        boolean isRejected = !requests.isEmpty() && "REJECTED".equalsIgnoreCase(requests.get(0).getStatus());

        if (venues.isEmpty()) {
            User owner = userRepository.findById(ownerUserId).orElse(null);
            if (owner != null) {
                String venueName = (!requests.isEmpty() && requests.get(0).getVenueName() != null && !requests.get(0).getVenueName().isBlank())
                        ? requests.get(0).getVenueName() : "Kick Off Arena";
                String area = (!requests.isEmpty() && requests.get(0).getArea() != null && !requests.get(0).getArea().isBlank())
                        ? requests.get(0).getArea() : "Dhanmondi";

                CreateVenueRequest autoReq = new CreateVenueRequest(
                        venueName, area, area,
                        new java.math.BigDecimal("23.8103"), new java.math.BigDecimal("90.4125"),
                        new java.math.BigDecimal("2000"), "06:00", "23:00",
                        "floodlights,parking", owner.getPhone(), owner.getEmail(),
                        "FULL_ONLY", "FREE_24H_50_6H", true,
                        "Standard rules", null, false
                );
                createVenue(ownerUserId, autoReq);
                venues = venueRepository.findByOwnerId(ownerUserId);
            }
        }

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
        var requests = turfRequestRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId);
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
        if (req.mlPricingEnabled() != null) venue.setMlPricingEnabled(req.mlPricingEnabled());
        if (req.basePrice() != null) venue.setBasePrice(req.basePrice());

        return toDto(venueRepository.save(venue));
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
            req.sportSlugs().forEach(slug ->
                    sportRepository.findBySlug(slug.toLowerCase(Locale.ROOT)).ifPresent(pitch.getSports()::add));
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

    /** Dedicated method to just toggle ML Pricing */
    public VenueManagementDto updateMlSettings(Long ownerUserId, Long venueId, boolean mlPricingEnabled) {
        Venue venue = requireOwnership(ownerUserId, venueId);
        venue.setMlPricingEnabled(mlPricingEnabled);
        return toDto(venueRepository.save(venue));
    }

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
        if (hhmm == null) return null;
        String[] parts = hhmm.split(":");
        return LocalTime.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
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

        List<String> photos = (v.getPhotos() == null || v.getPhotos().isBlank())
                ? List.of()
                : List.of(v.getPhotos().split(","));

        return new VenueManagementDto(
                v.getId(), v.getVenueCode(), v.getSlug(), v.getName(), status,
                v.getAddress(), v.getArea(), v.getLat(), v.getLng(),
                v.getOpenTime(), v.getCloseTime(),
                v.getAmenities(), v.getRules(),
                v.getContactPhone(), v.getContactEmail(),
                v.getDepositPolicy(), v.getCancelPolicy(), v.getBasePrice(), v.isAllowSplitPayment(),
                isVerified, v.isTournamentReady(), v.isHasPromotion(), v.getPromotionLabel(),
                v.isMlPricingEnabled(), photos, pitches, rules
        );
    }

    private VenueManagementDto.PitchDto toPitchDto(Pitch p) {
        List<String> sportSlugs = (p.getSports() == null)
                ? List.of()
                : p.getSports().stream().filter(Objects::nonNull).map(Sport::getSlug).filter(Objects::nonNull).toList();
        return new VenueManagementDto.PitchDto(
                p.getId(), p.getName(), p.getFormat(), p.getSurfaceType(),
                p.getSurfaceDetail(), p.getDimensions(), p.getLighting(),
                p.getMaxPlayers(), p.isIndoor(), p.isActive(), sportSlugs
        );
    }

    private VenueManagementDto.PricingRuleDto toPricingRuleDto(SportPricingRule r) {
        String sportSlug = (r.getSport() != null) ? r.getSport().getSlug() : "football";
        return new VenueManagementDto.PricingRuleDto(
                r.getId(), sportSlug, r.getWindowType(),
                r.getRate(), r.getSlotDurationMin(), r.getBufferMin(),
                r.getWindowStart(), r.getWindowEnd(), r.getDaysOfWeek(), r.isActive()
        );
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

        List<OwnerCalendarDto.PitchHeaderDto> pitchHeaders = pitches.stream().map(p -> new OwnerCalendarDto.PitchHeaderDto(
                p.getId(),
                p.getName(),
                p.getFormat() != null ? p.getFormat() : "Standard",
                p.getSports().stream().map(Sport::getSlug).toList()
        )).toList();

        List<OwnerCalendarDto.TimeRowDto> rows = buildCalendarRowsFromDbSlots(pitchHeaders, dbSlots);

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

    public void createManualBooking(Long ownerUserId, Long venueId, ManualBookingRequestDto req) {
        if (req.getSlotId() != null) {
            slotRepository.findById(req.getSlotId()).ifPresent(s -> {
                s.setStatus(SlotStatus.BOOKED);
                slotRepository.save(s);

                // Create confirmed Booking record so manual calendar bookings appear in Reports, Revenue & Customer logs
                BigDecimal amount = (s.getPrice() != null) ? s.getPrice() : BigDecimal.valueOf(2000);
                String bookingCode = "MB-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
                Long targetVenueId = (s.getVenueId() != null && s.getVenueId() > 0) ? s.getVenueId() : venueId;

                Booking booking = Booking.builder()
                        .bookingCode(bookingCode)
                        .slot(s)
                        .userId(ownerUserId)
                        .venueId(targetVenueId)
                        .pitchId(s.getPitch() != null ? s.getPitch().getId() : 0L)
                        .bookingDate(s.getSlotDate() != null ? s.getSlotDate() : LocalDate.now())
                        .startTime(s.getStartTime() != null ? s.getStartTime() : LocalTime.of(16, 0))
                        .endTime(s.getEndTime() != null ? s.getEndTime() : LocalTime.of(17, 30))
                        .grossAmount(amount)
                        .netAmount(amount)
                        .status(BookingStatus.CONFIRMED)
                        .build();

                bookingRepository.save(booking);
            });
        }
    }

    private List<Slot> seedSlotsForDate(Long venueId, List<Pitch> pitches, LocalDate date) {
        LocalTime[] startTimes = {
                LocalTime.of(16, 0),
                LocalTime.of(17, 45),
                LocalTime.of(19, 30),
                LocalTime.of(21, 0),
                LocalTime.of(22, 30)
        };
        List<Slot> createdSlots = new ArrayList<>();
        for (Pitch p : pitches) {
            for (LocalTime start : startTimes) {
                Slot slot = Slot.builder()
                        .pitch(p)
                        .venueId(venueId)
                        .slotDate(date)
                        .price(java.math.BigDecimal.valueOf(2000))
                        .startTime(start)
                        .endTime(start.plusMinutes(90))
                        .status(SlotStatus.AVAILABLE)
                        .build();
                createdSlots.add(slotRepository.save(slot));
            }
        }
        return createdSlots;
    }

    private List<OwnerCalendarDto.TimeRowDto> buildCalendarRowsFromDbSlots(
            List<OwnerCalendarDto.PitchHeaderDto> pitchHeaders,
            List<Slot> dbSlots) {

        DateTimeFormatter timeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);

        java.util.Map<String, List<Slot>> timeGroupedMap = dbSlots.stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        s -> s.getStartTime().format(timeFormatter),
                        java.util.LinkedHashMap::new,
                        java.util.stream.Collectors.toList()
                ));

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

                if (pitchSlot != null) {
                    String variant = "online";
                    String label = "Available";
                    String kind = "event";
                    boolean openable = true;

                    if (pitchSlot.getStatus() == SlotStatus.BOOKED) {
                        variant = "online";
                        label = "Booked · ৳" + (pitchSlot.getPrice() != null ? pitchSlot.getPrice().intValue() : 2000);
                    } else if (pitchSlot.getStatus() == SlotStatus.HELD) {
                        variant = "held";
                        label = "Held · checkout";
                    } else if (pitchSlot.getStatus() == SlotStatus.BLOCKED) {
                        variant = "blocked";
                        label = "Maintenance";
                        openable = false;
                    } else {
                        kind = "add";
                        label = "";
                        openable = false;
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
                            .build());
                } else {
                    cells.add(OwnerCalendarDto.CellDto.builder()
                            .slotId(null)
                            .pitchId(header.getId())
                            .kind("add")
                            .variant(null)
                            .label("")
                            .openable(false)
                            .status("AVAILABLE")
                            .price(2000.0)
                            .build());
                }
            }

            timeRows.add(new OwnerCalendarDto.TimeRowDto(timeLabel, cells));
        }

        return timeRows;
    }
}
