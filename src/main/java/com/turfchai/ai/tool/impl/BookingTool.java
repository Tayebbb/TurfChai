package com.turfchai.ai.tool.impl;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolArgs;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;
import com.turfchai.booking.dto.response.BookingResponse;
import com.turfchai.booking.entity.Booking;
import com.turfchai.booking.entity.Slot;
import com.turfchai.booking.entity.SlotStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.booking.service.BookingService;
import com.turfchai.booking.service.SlotAvailabilityService;
import com.turfchai.booking.service.SlotDisplayStatus;
import com.turfchai.booking.service.SlotTimePolicy;
import com.turfchai.exception.BookingNotFoundException;
import com.turfchai.payment.dto.response.RefundPreviewResponse;
import com.turfchai.payment.service.PaymentService;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import com.turfchai.venue.service.VenueSearchCriteria;
import com.turfchai.venue.service.VenueSearchService;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Live booking lookups: real slots, the caller's real bookings and the real
 * refund a cancellation would produce.
 *
 * <p>
 * <b>Deliberately read-only.</b> Confirming a booking needs a slot hold plus a
 * payment record, and TurfChai has no online gateway — a "create" action here
 * would either write a confirmed booking nobody paid for (the hole that closed
 * {@code POST /api/v1/bookings} to players) or claim a payment that never
 * happened. The tool returns the deep link the user finishes the job on
 * instead.
 *
 * <p>
 * Availability is public. Every other action is scoped to
 * {@link ToolContext#authenticatedUserId()} and goes through
 * {@link BookingService#getBooking}, which answers "not found" for a booking
 * that belongs to somebody else.
 */
@Component
public class BookingTool implements Tool {

    private static final int MAX_SLOT_ROWS = 24;
    private static final int MAX_BOOKING_ROWS = 10;

    private final BookingService bookingService;
    private final BookingRepository bookingRepository;
    private final SlotAvailabilityService slotAvailabilityService;
    private final SlotTimePolicy slotTimePolicy;
    private final VenueRepository venueRepository;
    private final VenueSearchService venueSearchService;
    private final PaymentService paymentService;

    public BookingTool(BookingService bookingService,
            BookingRepository bookingRepository,
            SlotAvailabilityService slotAvailabilityService,
            SlotTimePolicy slotTimePolicy,
            VenueRepository venueRepository,
            VenueSearchService venueSearchService,
            PaymentService paymentService) {
        this.bookingService = bookingService;
        this.bookingRepository = bookingRepository;
        this.slotAvailabilityService = slotAvailabilityService;
        this.slotTimePolicy = slotTimePolicy;
        this.venueRepository = venueRepository;
        this.venueSearchService = venueSearchService;
        this.paymentService = paymentService;
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "manage_booking",
                "Read live booking data. action=check_availability needs `venue` and `date` and lists that day's real "
                        + "slots and prices (works for signed-out visitors). action=list returns the signed-in user's "
                        + "bookings. action=get needs `bookingCode`. action=cancel_quote needs `bookingCode` and "
                        + "returns the real refund the venue's policy allows. "
                        + "This tool cannot create, pay for or cancel anything — TurfChai takes payment at the venue, "
                        + "so send the user to the link in the result to finish those steps.",
                List.of(
                        ToolParam.required("action", "string",
                                "One of: check_availability, list, get, cancel_quote"),
                        ToolParam.optional("venue", "string", "Venue slug, name or numeric id from search_venues"),
                        ToolParam.optional("date", "string", "Date to check, ISO format YYYY-MM-DD"),
                        ToolParam.optional("bookingCode", "string", "Booking code, e.g. TC-A1B2C3")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        String action = ToolArgs.string(arguments, "action");
        if (action == null) {
            return ToolResult.fail("Missing required argument: action");
        }
        return switch (action.toLowerCase()) {
            case "check_availability" -> checkAvailability(arguments);
            case "list" -> listBookings(context);
            case "get" -> getBooking(arguments, context);
            case "cancel_quote" -> cancelQuote(arguments, context);
            case "create", "cancel" -> ToolResult.fail(
                    "This assistant cannot " + action.toLowerCase() + " a booking. Use check_availability, then send "
                            + "the user to the venue page to book, or to /player/cancel to cancel.");
            default -> ToolResult.fail("Unknown action: " + action);
        };
    }

    // ── availability (public) ────────────────────────────────────────────

    private ToolResult checkAvailability(Map<String, Object> arguments) {
        String venueToken = ToolArgs.string(arguments, "venue");
        if (venueToken == null) {
            return ToolResult.fail("check_availability requires `venue` (a slug or id from search_venues)");
        }
        Optional<Venue> found = resolveVenue(venueToken);
        if (found.isEmpty()) {
            return ToolResult.fail("No venue matches '" + venueToken + "'. Call search_venues first.");
        }
        Venue venue = found.get();

        LocalDate date = ToolArgs.date(arguments, "date");
        if (date == null) {
            return ToolResult.fail("check_availability requires `date` in YYYY-MM-DD format");
        }
        if (date.isBefore(LocalDate.now())) {
            return ToolResult.fail("That date is in the past — ask the user for an upcoming date.");
        }

        // Same call the venue page makes; slots are generated on demand for a
        // day that has none yet.
        List<Slot> slots = slotAvailabilityService.ensureSlots(venue.getId(), date);

        List<Map<String, Object>> bookable = slots.stream()
                .filter(BookingTool::isAvailable)
                .filter(slot -> !slotTimePolicy.hasStarted(slot))
                .sorted(Comparator.comparing(Slot::getStartTime))
                .limit(MAX_SLOT_ROWS)
                .map(BookingTool::toSlotRow)
                .toList();

        long takenCount = slots.stream().filter(slot -> !isAvailable(slot)).count();

        Map<String, Object> body = ToolArgs.row();
        body.put("venue", venue.getName());
        ToolArgs.put(body, "area", venue.getArea());
        body.put("slug", venue.getSlug());
        body.put("date", date.toString());
        body.put("slotsPublished", slots.size());
        body.put("availableCount", bookable.size());
        body.put("unavailableCount", takenCount);
        body.put("availableSlots", bookable);
        body.put("bookAt", "/player/venues/" + venue.getSlug());
        if (slots.isEmpty()) {
            body.put("note", "This venue has published no slots for that date.");
        } else if (bookable.isEmpty()) {
            body.put("note", "Every slot that day is taken, blocked or already started.");
        }
        return ToolResult.ok(body);
    }

    /**
     * Reads status the way every other client does, so a hold that lapsed
     * before the cleanup job ran is not reported to the user as taken.
     */
    private static boolean isAvailable(Slot slot) {
        return SlotStatus.AVAILABLE.name().equals(SlotDisplayStatus.of(slot));
    }

    private static Map<String, Object> toSlotRow(Slot slot) {
        Map<String, Object> row = ToolArgs.row();
        ToolArgs.put(row, "slotId", slot.getId());
        ToolArgs.put(row, "pitch", slot.getPitch() == null ? null : slot.getPitch().getName());
        ToolArgs.put(row, "startTime", slot.getStartTime());
        ToolArgs.put(row, "endTime", slot.getEndTime());
        ToolArgs.put(row, "priceBdt", slot.getPrice());
        return row;
    }

    // ── the caller's own bookings ────────────────────────────────────────

    private ToolResult listBookings(ToolContext context) {
        if (!context.isAuthenticated()) {
            return ToolResult.fail("The user is not signed in, so their bookings cannot be read. "
                    + "Ask them to sign in at /auth.");
        }
        List<BookingResponse> bookings = bookingService.listUserBookings(context.authenticatedUserId()).stream()
                .map(bookingService::toResponse)
                .sorted(Comparator.comparing(BookingResponse::getBookingDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(MAX_BOOKING_ROWS)
                .toList();

        Map<String, Object> body = ToolArgs.row();
        body.put("count", bookings.size());
        body.put("bookings", bookings.stream().map(BookingTool::toBookingRow).toList());
        if (bookings.isEmpty()) {
            body.put("note", "This user has no bookings yet.");
        }
        return ToolResult.ok(body);
    }

    private ToolResult getBooking(Map<String, Object> arguments, ToolContext context) {
        return withOwnedBooking(arguments, context, booking -> {
            Map<String, Object> row = toBookingRow(bookingService.toResponse(booking));
            row.put("payments", paymentService
                    .getPaymentsForBooking(context.authenticatedUserId(), booking.getId())
                    .stream()
                    .map(payment -> {
                        Map<String, Object> leg = ToolArgs.row();
                        ToolArgs.put(leg, "type", payment.getType());
                        ToolArgs.put(leg, "method", payment.getMethod());
                        ToolArgs.put(leg, "status", payment.getStatus());
                        ToolArgs.put(leg, "amountBdt", payment.getAmount());
                        ToolArgs.put(leg, "fromWallet", payment.getFromWallet());
                        return leg;
                    })
                    .toList());
            return ToolResult.ok(row);
        });
    }

    private ToolResult cancelQuote(Map<String, Object> arguments, ToolContext context) {
        return withOwnedBooking(arguments, context, booking -> {
            RefundPreviewResponse preview = paymentService.previewRefund(context.authenticatedUserId(),
                    booking.getId());

            Map<String, Object> body = ToolArgs.row();
            ToolArgs.put(body, "bookingCode", booking.getBookingCode());
            ToolArgs.put(body, "cancelPolicy", preview.getCancelPolicy());
            body.put("hoursUntilStart", Math.round(preview.getHoursUntilStart() * 10.0) / 10.0);
            body.put("refundPercent", preview.getRefundPercent());
            ToolArgs.put(body, "refundAmountBdt", preview.getRefundAmount());
            ToolArgs.put(body, "amountPaidBdt", preview.getAmountPaid());
            body.put("confirmAt", "/player/cancel?bookingId=" + booking.getId());
            body.put("note", "Nothing has been cancelled. The user must confirm on the cancel screen.");
            return ToolResult.ok(body);
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    /** Resolves a booking code to a booking the caller is allowed to see. */
    private ToolResult withOwnedBooking(Map<String, Object> arguments, ToolContext context,
            java.util.function.Function<Booking, ToolResult> action) {
        if (!context.isAuthenticated()) {
            return ToolResult.fail("The user is not signed in, so this booking cannot be read. "
                    + "Ask them to sign in at /auth.");
        }
        String code = ToolArgs.string(arguments, "bookingCode");
        if (code == null) {
            return ToolResult.fail("This action requires `bookingCode`");
        }
        Optional<Booking> found = bookingRepository.findByBookingCode(code);
        if (found.isEmpty()) {
            return ToolResult.fail("No booking found with code " + code);
        }
        try {
            // Fail fast on ownership before doing any work. PaymentService
            // re-checks internally, so a foreign booking is refused twice over;
            // this is the layer that keeps the refusal cheap and explicit.
            Booking booking = bookingService.getBooking(context.authenticatedUserId(), found.get().getId());
            return action.apply(booking);
        } catch (BookingNotFoundException e) {
            return ToolResult.fail("No booking found with code " + code);
        }
    }

    private Optional<Venue> resolveVenue(String token) {
        Optional<Venue> bySlug = venueRepository.findBySlug(token);
        if (bySlug.isPresent()) {
            return bySlug;
        }
        try {
            Optional<Venue> byId = venueRepository.findById(Long.valueOf(token));
            if (byId.isPresent()) {
                return byId;
            }
        } catch (NumberFormatException ignored) {
            // Not an id, so fall through to the name search.
        }
        // The model relays whatever the user typed, which is normally the
        // venue's name. Accepting only the slug made "check availability at
        // Tejgaon Kick Zone" a dead end.
        return venueSearchService
                .search(new VenueSearchCriteria(token, null, null, null, null, null, null, null, null, null, null),
                        0, 1, "rating")
                .items().stream()
                .findFirst()
                .flatMap(match -> venueRepository.findBySlug(match.slug()));
    }

    private static Map<String, Object> toBookingRow(BookingResponse booking) {
        Map<String, Object> row = ToolArgs.row();
        ToolArgs.put(row, "bookingCode", booking.getBookingCode());
        ToolArgs.put(row, "status", booking.getStatus());
        ToolArgs.put(row, "venue", booking.getVenueName());
        ToolArgs.put(row, "area", booking.getVenueArea());
        ToolArgs.put(row, "pitch", booking.getPitchName());
        ToolArgs.put(row, "date", booking.getBookingDate());
        ToolArgs.put(row, "startTime", booking.getStartTime());
        ToolArgs.put(row, "endTime", booking.getEndTime());
        ToolArgs.put(row, "amountBdt", booking.getAmount());
        ToolArgs.put(row, "promoCode", booking.getPromoCode());
        ToolArgs.put(row, "checkedInAt", booking.getCheckedInAt());
        ToolArgs.put(row, "detailsAt", booking.getId() == null ? null : "/player/bookings/" + booking.getId());
        return row;
    }
}
