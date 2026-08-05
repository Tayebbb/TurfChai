package com.turfchai.ai.tool.mock;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;

import java.util.List;
import java.util.Map;

/**
 * Mock payment status lookup. Read-only by design — initiating or refunding
 * payments will require explicit user action through the app UI, never the
 * chat assistant alone.
 */
public class MockPaymentTool implements Tool {

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "get_payment_status",
                "Look up the payment status of one of the current user's bookings by booking code.",
                List.of(ToolParam.required("bookingCode", "string", "Booking code, e.g. TC-48291")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        Object code = arguments.get("bookingCode");
        if (code == null || code.toString().isBlank()) {
            return ToolResult.fail("Missing required argument: bookingCode");
        }
        return ToolResult.ok(Map.of(
                "bookingCode", code.toString().trim(),
                "paymentStatus", "success",
                "method", "bkash",
                "amountBdt", 2500,
                "paidAt", "2026-08-04T18:32:00+06:00",
                "supportedMethods", List.of("bkash", "nagad", "card", "cash")));
    }
}
