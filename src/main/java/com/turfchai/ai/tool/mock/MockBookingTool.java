package com.turfchai.ai.tool.mock;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Mock booking operations (availability, create, list, cancel). Bookings
 * created during a session are kept in memory so the conversation is
 * consistent. Replace with a BookingService-backed implementation later.
 */
public class MockBookingTool implements Tool {

    private static final List<String> SLOTS = List.of("06:00-07:00", "07:00-08:00", "17:00-18:00", "19:00-20:00",
            "21:00-22:00");

    private final Map<String, Map<String, Object>> bookings = new ConcurrentHashMap<>();
    private final AtomicInteger sequence = new AtomicInteger(48290);

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "manage_booking",
                "Booking operations. action=check_availability requires venueId and date; action=create requires venueId, date and time; action=list lists the user's bookings; action=cancel requires bookingCode.",
                List.of(
                        ToolParam.required("action", "string", "One of: check_availability, create, list, cancel"),
                        ToolParam.optional("venueId", "string", "Venue id, e.g. V-0044"),
                        ToolParam.optional("date", "string", "Date in YYYY-MM-DD"),
                        ToolParam.optional("time", "string", "Slot window, e.g. 19:00-20:00"),
                        ToolParam.optional("bookingCode", "string", "Booking code, e.g. TC-48291")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        String action = string(arguments, "action");
        if (action == null) {
            return ToolResult.fail("Missing required argument: action");
        }
        return switch (action) {
            case "check_availability" -> checkAvailability(arguments);
            case "create" -> create(arguments, context);
            case "list" -> list(context);
            case "cancel" -> cancel(arguments, context);
            default -> ToolResult.fail("Unknown action: " + action);
        };
    }

    private ToolResult checkAvailability(Map<String, Object> args) {
        String venueId = string(args, "venueId");
        String date = string(args, "date");
        if (venueId == null || date == null) {
            return ToolResult.fail("check_availability requires venueId and date");
        }
        return ToolResult.ok(Map.of(
                "venueId", venueId,
                "date", date,
                "availableSlots", SLOTS,
                "note", "Peak slots (17:00 onwards) are priced higher"));
    }

    private ToolResult create(Map<String, Object> args, ToolContext context) {
        String venueId = string(args, "venueId");
        String date = string(args, "date");
        String time = string(args, "time");
        if (venueId == null || date == null || time == null) {
            return ToolResult.fail("create requires venueId, date and time");
        }
        if (bookings.size() >= 1000) {
            return ToolResult.fail("Mock booking store is full");
        }
        String code = "TC-" + sequence.incrementAndGet();
        Map<String, Object> booking = Map.of(
                "bookingCode", code,
                "venueId", venueId,
                "date", date,
                "time", time,
                "status", "confirmed",
                "userId", String.valueOf(context.userId()));
        bookings.put(code, booking);
        return ToolResult.ok(booking);
    }

    private ToolResult list(ToolContext context) {
        List<Map<String, Object>> own = bookings.values().stream()
                .filter(b -> b.get("userId").equals(String.valueOf(context.userId())))
                .toList();
        return ToolResult.ok(Map.of("count", own.size(), "bookings", own));
    }

    private ToolResult cancel(Map<String, Object> args, ToolContext context) {
        String code = string(args, "bookingCode");
        if (code == null) {
            return ToolResult.fail("cancel requires bookingCode");
        }
        Map<String, Object> booking = bookings.get(code);
        if (booking == null || !booking.get("userId").equals(String.valueOf(context.userId()))) {
            return ToolResult.fail("Booking not found: " + code);
        }
        bookings.remove(code);
        return ToolResult.ok(Map.of(
                "bookingCode", code,
                "status", "cancelled",
                "refundNote", "Refund is calculated per the venue's cancellation policy"));
    }

    private String string(Map<String, Object> args, String key) {
        Object value = args.get(key);
        return value == null || value.toString().isBlank() ? null : value.toString().trim();
    }
}
