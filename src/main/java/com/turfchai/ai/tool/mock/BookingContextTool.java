package com.turfchai.ai.tool.mock;

import com.turfchai.ai.state.BookingState;
import com.turfchai.ai.state.ConversationStateStore;
import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;

import java.util.List;
import java.util.Map;

/**
 * Lets the model persist confirmed booking details into structured session
 * state — the single source of truth for in-progress bookings (chat history
 * is never used as application state).
 */
public class BookingContextTool implements Tool {

    private final ConversationStateStore stateStore;

    public BookingContextTool(ConversationStateStore stateStore) {
        this.stateStore = stateStore;
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "update_booking_context",
                "Save booking details the user has confirmed (sport, area, venue, date, time, players, budget) into session state. Call whenever the user provides or changes a detail.",
                List.of(
                        ToolParam.optional("sport", "string", "Chosen sport"),
                        ToolParam.optional("area", "string", "Preferred area"),
                        ToolParam.optional("venueId", "string", "Selected venue id, e.g. V-0044"),
                        ToolParam.optional("venueName", "string", "Selected venue name"),
                        ToolParam.optional("date", "string", "Booking date, ISO format YYYY-MM-DD"),
                        ToolParam.optional("time", "string", "Slot time window, e.g. 19:00-20:00"),
                        ToolParam.optional("players", "integer", "Number of players"),
                        ToolParam.optional("budget", "integer", "Budget in BDT")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        BookingState state = stateStore.get(context.sessionId());
        setIfPresent(arguments, "sport", state::setSport);
        setIfPresent(arguments, "area", state::setArea);
        setIfPresent(arguments, "venueId", state::setVenueId);
        setIfPresent(arguments, "venueName", state::setVenueName);
        setIfPresent(arguments, "date", state::setDate);
        setIfPresent(arguments, "time", state::setTime);
        if (arguments.get("players") instanceof Number n)
            state.setPlayers(n.intValue());
        if (arguments.get("budget") instanceof Number n)
            state.setBudget(n.intValue());
        return ToolResult.ok(Map.of(
                "saved", true,
                "currentContext", state.summary(),
                "readyToBook", state.isReadyToBook()));
    }

    private void setIfPresent(Map<String, Object> args, String key, java.util.function.Consumer<String> setter) {
        Object value = args.get(key);
        if (value != null && !value.toString().isBlank()) {
            setter.accept(sanitize(value.toString()));
        }
    }

    /**
     * State values are later injected into the system prompt, so strip
     * newlines and cap length to close the second-order injection channel.
     */
    private String sanitize(String value) {
        String cleaned = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return cleaned.length() > 80 ? cleaned.substring(0, 80) : cleaned;
    }
}
