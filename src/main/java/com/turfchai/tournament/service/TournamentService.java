package com.turfchai.tournament.service;

import com.turfchai.model.User;
import com.turfchai.tournament.entity.Tournament;
import com.turfchai.tournament.entity.TournamentFixture;
import com.turfchai.tournament.entity.TournamentPitchReservation;
import com.turfchai.tournament.entity.TournamentTeam;
import com.turfchai.tournament.repository.TournamentFixtureRepository;
import com.turfchai.tournament.repository.TournamentPitchReservationRepository;
import com.turfchai.tournament.repository.TournamentRepository;
import com.turfchai.tournament.repository.TournamentTeamRepository;
import com.turfchai.tournament.service.TournamentRequests.CreateTournamentRequest;
import com.turfchai.tournament.service.TournamentRequests.RegisterPlayerRequest;
import com.turfchai.tournament.service.TournamentRequests.RegisterTeamRequest;
import com.turfchai.tournament.service.TournamentRequests.ReserveSlotsRequest;
import com.turfchai.tournament.service.TournamentRequests.SlotRequest;
import com.turfchai.tournament.service.TournamentViews.CostSummary;
import com.turfchai.tournament.service.TournamentViews.FixtureView;
import com.turfchai.tournament.service.TournamentViews.ReservationView;
import com.turfchai.tournament.service.TournamentViews.TeamView;
import com.turfchai.tournament.service.TournamentViews.TournamentCard;
import com.turfchai.tournament.service.TournamentViews.TournamentView;
import com.turfchai.venue.dto.PagedResponse;
import com.turfchai.venue.entity.Pitch;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.PitchRepository;
import com.turfchai.venue.repository.VenueRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Host tournament hub: tournament lifecycle, team registration with
 * entry-fee tracking, multi-pitch slot reservation with conflict avoidance,
 * and knockout fixture bracket generation.
 */
@Service
public class TournamentService {

    /** Bundle discount applied when a host books this many slots or more. */
    static final int BUNDLE_DISCOUNT_MIN_SLOTS = 12;
    static final BigDecimal BUNDLE_DISCOUNT_RATE = new BigDecimal("0.04");
    static final BigDecimal DEPOSIT_RATE = new BigDecimal("0.40");

    private static final SecureRandom RANDOM = new SecureRandom();

    private final TournamentRepository tournaments;
    private final TournamentTeamRepository teams;
    private final TournamentFixtureRepository fixtures;
    private final TournamentPitchReservationRepository reservations;
    private final VenueRepository venues;
    private final PitchRepository pitches;

    public TournamentService(TournamentRepository tournaments,
                             TournamentTeamRepository teams,
                             TournamentFixtureRepository fixtures,
                             TournamentPitchReservationRepository reservations,
                             VenueRepository venues,
                             PitchRepository pitches) {
        this.tournaments = tournaments;
        this.teams = teams;
        this.fixtures = fixtures;
        this.reservations = reservations;
        this.venues = venues;
        this.pitches = pitches;
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    @Transactional
    public TournamentView create(User host, CreateTournamentRequest request) {
        if (!request.windowEnd().isAfter(request.windowStart())) {
            throw new IllegalArgumentException("windowEnd must be after windowStart");
        }
        Venue venue = venues.findBySlug(request.venueSlug())
                .orElseThrow(() -> new IllegalArgumentException("Unknown venue: " + request.venueSlug()));

        Tournament t = new Tournament();
        t.setCode(nextCode());
        t.setName(request.name().trim());
        t.setHost(host);
        t.setVenue(venue);
        t.setTournamentDate(request.date());
        t.setWindowStart(request.windowStart());
        t.setWindowEnd(request.windowEnd());
        t.setFormat(request.format().toUpperCase(Locale.ROOT));
        t.setTeamCapacity(request.teamCapacity());
        t.setEntryFeePerTeam(request.entryFeePerTeam());
        t.setPrizePool(request.prizePool() == null ? BigDecimal.ZERO : request.prizePool());
        t.setPrivacy(request.privacy() == null ? "OPEN" : request.privacy().toUpperCase(Locale.ROOT));
        t.setInviteCode("t/" + slugify(request.name()) + "-" + randomDigits(4));
        t.setStatus("PUBLISHED");
        t.setBalanceDueDate(request.date().minusDays(3));
        return toView(tournaments.save(t));
    }

    @Transactional(readOnly = true)
    public TournamentView get(String code) {
        return toView(require(code));
    }

    // ------------------------------------------------------------------
    // Teams
    // ------------------------------------------------------------------

    @Transactional
    public TeamView registerTeam(String code, RegisterTeamRequest request) {
        Tournament t = require(code);
        // Count-then-insert: a concurrent registration burst could briefly
        // exceed capacity. Acceptable for the interim demo identity model;
        // revisit with a tournament-row lock once real auth lands.
        long registered = teams.countByTournamentId(t.getId());
        if (registered >= t.getTeamCapacity()) {
            throw new TournamentConflictException("Tournament is full (" + t.getTeamCapacity() + " teams)");
        }
        if (teams.existsByTournamentIdAndNameIgnoreCase(t.getId(), request.name().trim())) {
            throw new TournamentConflictException("A team named '" + request.name().trim() + "' is already registered");
        }
        TournamentTeam team = new TournamentTeam();
        team.setTournament(t);
        team.setName(request.name().trim());
        team.setCaptainName(request.captainName());
        try {
            return toView(teams.saveAndFlush(team));
        } catch (DataIntegrityViolationException e) {
            throw new TournamentConflictException("A team named '" + request.name().trim() + "' is already registered");
        }
    }

    /**
     * Marks a team's entry fee as paid. Records tracking state only — actual
     * payment capture belongs to the payments module.
     */
    @Transactional
    public TeamView markEntryFeePaid(String code, Long teamId) {
        Tournament t = require(code);
        TournamentTeam team = teams.findById(teamId)
                .filter(x -> x.getTournament().getId().equals(t.getId()))
                .orElseThrow(() -> new TournamentNotFoundException("No team " + teamId + " in " + code));
        team.setEntryFeeStatus("PAID");
        team.setEntryFeePaid(t.getEntryFeePerTeam());
        return toView(team);
    }

    // ------------------------------------------------------------------
    // Player-facing browse + registration
    // ------------------------------------------------------------------

    /** Published/confirmed tournaments a player can discover. */
    @Transactional(readOnly = true)
    public PagedResponse<TournamentCard> browse(boolean openOnly, boolean upcomingOnly,
                                                User viewer, int page, int size) {
        Page<Tournament> results = tournaments.browse(
                openOnly, upcomingOnly ? LocalDate.now() : null, PageRequest.of(page, size));
        List<TournamentCard> items = results.getContent().stream()
                .map(t -> toCard(t, viewer))
                .toList();
        return new PagedResponse<>(items, results.getNumber(), results.getSize(),
                results.getTotalElements(), results.getTotalPages());
    }

    /** Tournaments the player has registered a team for, newest first. */
    @Transactional(readOnly = true)
    public List<TournamentCard> myTournaments(User player) {
        return tournaments.findRegisteredBy(player.getId()).stream()
                .map(t -> toCard(t, player))
                .toList();
    }

    /**
     * Registers the signed-in player's team. The entry fee is recorded as
     * DUE — capture is the payments module's job, so nothing here pretends
     * a payment succeeded.
     */
    @Transactional
    public TeamView register(String code, User player, RegisterPlayerRequest request) {
        Tournament t = require(code);
        if (!"PUBLISHED".equals(t.getStatus()) && !"CONFIRMED".equals(t.getStatus())) {
            throw new TournamentConflictException("Registration is not open for this tournament");
        }
        if (teams.countByTournamentId(t.getId()) >= t.getTeamCapacity()) {
            throw new TournamentConflictException("Tournament is full (" + t.getTeamCapacity() + " teams)");
        }
        String teamName = request.teamName().trim();
        if (teams.existsByTournamentIdAndNameIgnoreCase(t.getId(), teamName)) {
            throw new TournamentConflictException("A team named '" + teamName + "' is already registered");
        }

        TournamentTeam team = new TournamentTeam();
        team.setTournament(t);
        team.setName(teamName);
        team.setCaptainName(request.captainName() == null || request.captainName().isBlank()
                ? player.getFullName() : request.captainName().trim());
        team.setRegisteredBy(player);
        team.setContactPhone(request.contactPhone() == null || request.contactPhone().isBlank()
                ? player.getPhone() : request.contactPhone().trim());
        team.setEmergencyContact(request.emergencyContact());
        team.setJerseyNumber(request.jerseyNumber());
        team.setSkillLevel(request.skillLevel() == null || request.skillLevel().isBlank()
                ? null : request.skillLevel());
        team.setMedicalNotes(request.medicalNotes());
        team.setRegistrationCode(nextRegistrationCode());
        try {
            return toView(teams.saveAndFlush(team));
        } catch (DataIntegrityViolationException e) {
            throw new TournamentConflictException("A team named '" + teamName + "' is already registered");
        }
    }

    /** Withdraws the player's own registration while the fee is still unpaid. */
    @Transactional
    public void withdraw(String code, User player) {
        Tournament t = require(code);
        TournamentTeam team = teams.findByTournamentIdOrderByJoinedAtAsc(t.getId()).stream()
                .filter(x -> x.getRegisteredBy() != null && x.getRegisteredBy().getId().equals(player.getId()))
                .findFirst()
                .orElseThrow(() -> new TournamentNotFoundException("You are not registered for " + code));
        if ("PAID".equals(team.getEntryFeeStatus())) {
            throw new TournamentConflictException(
                    "Entry fee already paid — contact the organiser for a refund");
        }
        teams.delete(team);
    }

    private String nextRegistrationCode() {
        return "REG-" + Long.toString(Math.abs(RANDOM.nextLong()), 36).toUpperCase(Locale.ROOT)
                .substring(0, 6);
    }

    private TournamentCard toCard(Tournament t, User viewer) {
        List<TournamentTeam> registered = teams.findByTournamentIdOrderByJoinedAtAsc(t.getId());
        TournamentTeam mine = viewer == null ? null : registered.stream()
                .filter(x -> x.getRegisteredBy() != null && x.getRegisteredBy().getId().equals(viewer.getId()))
                .findFirst().orElse(null);
        return new TournamentCard(t.getCode(), t.getName(), t.getVenue().getSlug(), t.getVenue().getName(),
                t.getTournamentDate(), t.getWindowStart(), t.getWindowEnd(),
                t.getFormat(), t.getPrivacy(), t.getStatus(),
                t.getTeamCapacity(), registered.size(),
                Math.max(0, t.getTeamCapacity() - registered.size()),
                t.getEntryFeePerTeam(), t.getPrizePool(),
                mine == null ? null : mine.getRegistrationCode(),
                mine == null ? null : mine.getEntryFeeStatus());
    }

    // ------------------------------------------------------------------
    // Multi-pitch reservations
    // ------------------------------------------------------------------

    /**
     * Reserves a batch of pitch/time slots for the tournament date. The whole
     * batch is atomic: any conflict (existing reservation overlap, duplicate
     * slot within the request, pitch from another venue, slot outside the
     * tournament window) rejects the batch. Prices are computed server-side
     * from the venue's pricing rules. Each pitch row is pessimistically
     * locked before the overlap check so concurrent reservations on the same
     * pitch are serialized.
     */
    @Transactional
    public TournamentView reserveSlots(String code, ReserveSlotsRequest request) {
        Tournament t = require(code);
        List<SlotRequest> slots = request.slots();

        // In-request duplicate / overlap / window validation.
        for (int i = 0; i < slots.size(); i++) {
            SlotRequest a = slots.get(i);
            if (!a.endTime().isAfter(a.startTime())) {
                throw new IllegalArgumentException("Slot endTime must be after startTime");
            }
            if (a.startTime().isBefore(t.getWindowStart()) || a.endTime().isAfter(t.getWindowEnd())) {
                throw new IllegalArgumentException(
                        "Slot " + a.startTime() + "-" + a.endTime() + " is outside the tournament window "
                                + t.getWindowStart() + "-" + t.getWindowEnd());
            }
            for (int j = i + 1; j < slots.size(); j++) {
                SlotRequest b = slots.get(j);
                if (a.pitchId().equals(b.pitchId()) && overlaps(a, b)) {
                    throw new IllegalArgumentException(
                            "Request contains overlapping slots on pitch " + a.pitchId());
                }
            }
        }

        for (SlotRequest slot : slots) {
            // Pessimistic lock: serializes concurrent reservations per pitch.
            Pitch pitch = pitches.findByIdForUpdate(slot.pitchId())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown pitch: " + slot.pitchId()));
            if (!pitch.getVenue().getId().equals(t.getVenue().getId())) {
                throw new IllegalArgumentException(
                        "Pitch " + slot.pitchId() + " does not belong to venue " + t.getVenue().getSlug());
            }
            List<TournamentPitchReservation> clashes = reservations.findOverlapping(
                    pitch.getId(), t.getTournamentDate(), slot.startTime(), slot.endTime());
            if (!clashes.isEmpty()) {
                TournamentPitchReservation clash = clashes.get(0);
                throw new PitchConflictException(
                        "Pitch '" + pitch.getName() + "' is already reserved "
                                + clash.getStartTime() + "-" + clash.getEndTime()
                                + " on " + t.getTournamentDate());
            }
            TournamentPitchReservation r = new TournamentPitchReservation();
            r.setTournament(t);
            r.setPitch(pitch);
            r.setSlotDate(t.getTournamentDate());
            r.setStartTime(slot.startTime());
            r.setEndTime(slot.endTime());
            r.setPrice(slotPrice(t, pitch, slot.startTime(), slot.endTime()));
            reservations.save(r);
        }
        try {
            reservations.flush();
        } catch (DataIntegrityViolationException e) {
            // Unique-constraint backstop for an exact-duplicate slot race.
            throw new PitchConflictException("One of the requested slots was just taken");
        }
        t.setStatus("CONFIRMED");
        t.setDepositAmount(costSummary(t).deposit());
        return toView(t);
    }

    /**
     * Server-side slot pricing from the venue's pricing rules: picks the rule
     * whose window contains the slot start (falling back to the first active
     * rule) and scales its rate to the slot length. Larger-format pitches
     * (9/11-a-side) carry a 20% premium.
     */
    BigDecimal slotPrice(Tournament t, Pitch pitch, java.time.LocalTime start, java.time.LocalTime end) {
        List<com.turfchai.venue.entity.SportPricingRule> rules = t.getVenue().getPricingRules().stream()
                .filter(com.turfchai.venue.entity.SportPricingRule::isActive)
                .toList();
        if (rules.isEmpty()) {
            throw new IllegalArgumentException(
                    "Venue " + t.getVenue().getSlug() + " has no pricing configured");
        }
        com.turfchai.venue.entity.SportPricingRule rule = rules.stream()
                .filter(x -> !start.isBefore(x.getWindowStart()) && start.isBefore(x.getWindowEnd()))
                .findFirst()
                .orElse(rules.get(0));
        long minutes = java.time.Duration.between(start, end).toMinutes();
        BigDecimal price = rule.getRate()
                .multiply(BigDecimal.valueOf(minutes))
                .divide(BigDecimal.valueOf(rule.getSlotDurationMin()), 2, RoundingMode.HALF_UP);
        String format = pitch.getFormat();
        if ("9_a_side".equals(format) || "11_a_side".equals(format)) {
            price = price.multiply(new BigDecimal("1.20"));
        }
        return price.setScale(0, RoundingMode.HALF_UP);
    }

    // ------------------------------------------------------------------
    // Fixture bracket generation
    // ------------------------------------------------------------------

    /**
     * Generates a single-elimination first-round bracket from teams whose
     * entry fee is paid, seeded in join order. When the paid-team count is
     * not a power of two, the earliest-joined teams receive byes. Real
     * matches are scheduled onto the tournament's reserved slots in
     * chronological order — one match per reserved slot — so fixtures can
     * never collide on a pitch.
     */
    @Transactional
    public List<FixtureView> generateFixtures(String code) {
        Tournament t = require(code);
        List<TournamentTeam> paid = teams.findByTournamentIdOrderByJoinedAtAsc(t.getId()).stream()
                .filter(x -> "PAID".equals(x.getEntryFeeStatus()))
                .toList();
        if (paid.size() < 2) {
            throw new TournamentConflictException(
                    "Need at least 2 teams with paid entry fees to generate fixtures ("
                            + paid.size() + " paid)");
        }

        List<TournamentPitchReservation> slots = reservations
                .findByTournamentIdOrderBySlotDateAscStartTimeAsc(t.getId());

        int bracketSize = Integer.highestOneBit(paid.size());
        if (bracketSize < paid.size()) {
            bracketSize <<= 1;
        }
        int byes = bracketSize - paid.size();
        String round = roundLabel(bracketSize);
        int realMatches = (bracketSize / 2) - byes;
        if (slots.size() < realMatches) {
            throw new TournamentConflictException(
                    "Not enough reserved slots: " + realMatches + " matches need scheduling but only "
                            + slots.size() + " slots are reserved");
        }

        fixtures.deleteByTournamentId(t.getId());
        fixtures.flush();

        List<TournamentFixture> generated = new ArrayList<>();
        int matchNumber = 0;

        // Earliest-joined teams get the byes.
        for (int i = 0; i < byes; i++) {
            TournamentFixture f = new TournamentFixture();
            f.setTournament(t);
            f.setRoundLabel(round);
            f.setMatchNumber(++matchNumber);
            f.setTeamA(paid.get(i));
            f.setStatus("BYE");
            generated.add(f);
        }
        // Remaining teams are paired first-vs-last to spread seeds.
        List<TournamentTeam> field = paid.subList(byes, paid.size());
        int slotIdx = 0;
        for (int lo = 0, hi = field.size() - 1; lo < hi; lo++, hi--) {
            TournamentPitchReservation slot = slots.get(slotIdx++);
            TournamentFixture f = new TournamentFixture();
            f.setTournament(t);
            f.setRoundLabel(round);
            f.setMatchNumber(++matchNumber);
            f.setTeamA(field.get(lo));
            f.setTeamB(field.get(hi));
            f.setPitch(slot.getPitch());
            f.setStartTime(slot.getStartTime());
            generated.add(f);
        }
        return fixtures.saveAll(generated).stream().map(this::toView).toList();
    }

    @Transactional(readOnly = true)
    public List<FixtureView> listFixtures(String code) {
        Tournament t = require(code);
        return fixtures.findByTournamentIdOrderByStartTimeAscMatchNumberAsc(t.getId())
                .stream().map(this::toView).toList();
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private Tournament require(String code) {
        return tournaments.findByCode(code)
                .orElseThrow(() -> new TournamentNotFoundException("No tournament: " + code));
    }

    static String roundLabel(int bracketSize) {
        return switch (bracketSize) {
            case 2 -> "Final";
            case 4 -> "SF";
            case 8 -> "QF";
            case 16 -> "R16";
            default -> "R" + bracketSize;
        };
    }

    private static boolean overlaps(SlotRequest a, SlotRequest b) {
        return a.startTime().isBefore(b.endTime()) && a.endTime().isAfter(b.startTime());
    }

    private String nextCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            String code = "TR-CUP-" + randomDigits(4);
            if (!tournaments.existsByCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Could not allocate a tournament code");
    }

    private static String randomDigits(int n) {
        StringBuilder sb = new StringBuilder(n);
        for (int i = 0; i < n; i++) {
            sb.append(RANDOM.nextInt(10));
        }
        return sb.toString();
    }

    private static String slugify(String s) {
        return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    CostSummary costSummary(Tournament t) {
        List<TournamentPitchReservation> rs = reservations
                .findByTournamentIdOrderBySlotDateAscStartTimeAsc(t.getId());
        BigDecimal slotTotal = rs.stream().map(TournamentPitchReservation::getPrice)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = rs.size() >= BUNDLE_DISCOUNT_MIN_SLOTS
                ? slotTotal.multiply(BUNDLE_DISCOUNT_RATE).setScale(0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal total = slotTotal.subtract(discount);
        BigDecimal deposit = total.multiply(DEPOSIT_RATE).setScale(0, RoundingMode.HALF_UP);
        return new CostSummary(rs.size(), slotTotal, discount, total, deposit, total.subtract(deposit));
    }

    private TournamentView toView(Tournament t) {
        List<TeamView> teamViews = teams.findByTournamentIdOrderByJoinedAtAsc(t.getId())
                .stream().map(this::toView).toList();
        List<FixtureView> fixtureViews = fixtures
                .findByTournamentIdOrderByStartTimeAscMatchNumberAsc(t.getId())
                .stream().map(this::toView).toList();
        List<ReservationView> reservationViews = reservations
                .findByTournamentIdOrderBySlotDateAscStartTimeAsc(t.getId())
                .stream()
                .map(r -> new ReservationView(r.getId(), r.getPitch().getId(), r.getPitch().getName(),
                        r.getSlotDate(), r.getStartTime(), r.getEndTime(), r.getPrice()))
                .toList();
        return new TournamentView(t.getId(), t.getCode(), t.getName(),
                t.getVenue().getSlug(), t.getVenue().getName(),
                t.getTournamentDate(), t.getWindowStart(), t.getWindowEnd(),
                t.getFormat(), t.getTeamCapacity(), t.getEntryFeePerTeam(),
                t.getPrizePool(), t.getPrivacy(), t.getInviteCode(),
                t.getStatus(), t.getBalanceDueDate(),
                teamViews, fixtureViews, reservationViews, costSummary(t));
    }

    private TeamView toView(TournamentTeam x) {
        return new TeamView(x.getId(), x.getName(), x.getCaptainName(),
                x.getEntryFeeStatus(), x.getEntryFeePaid(), x.getRegistrationCode());
    }

    private FixtureView toView(TournamentFixture f) {
        return new FixtureView(f.getId(), f.getRoundLabel(), f.getMatchNumber(),
                f.getPitch() == null ? null : f.getPitch().getName(),
                f.getStartTime(),
                f.getTeamA() == null ? null : f.getTeamA().getName(),
                f.getTeamB() == null ? null : f.getTeamB().getName(),
                f.getStatus());
    }

    /** 404 — unknown tournament or team. */
    public static class TournamentNotFoundException extends RuntimeException {
        public TournamentNotFoundException(String message) {
            super(message);
        }
    }

    /** 409 — pitch slot already reserved. */
    public static class PitchConflictException extends RuntimeException {
        public PitchConflictException(String message) {
            super(message);
        }
    }

    /** 409 — domain-state conflict (full tournament, duplicate team, etc.). */
    public static class TournamentConflictException extends RuntimeException {
        public TournamentConflictException(String message) {
            super(message);
        }
    }
}
