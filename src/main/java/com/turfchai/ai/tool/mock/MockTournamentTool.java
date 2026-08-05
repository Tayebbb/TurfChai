package com.turfchai.ai.tool.mock;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;

import java.util.List;
import java.util.Map;

/** Mock tournament discovery. Replace with TournamentService later. */
public class MockTournamentTool implements Tool {

    private static final List<Map<String, Object>> TOURNAMENTS = List.of(
            Map.of("tournamentCode", "TR-CUP-0091", "name", "Dhaka Champions Cup",
                    "venue", "GreenTurf Arena, Banani", "date", "2026-08-22",
                    "format", "7_a_side", "entryFeeBdt", 5000, "prizePoolBdt", 50000,
                    "teamsRegistered", 12, "teamCapacity", 16, "privacy", "open"),
            Map.of("tournamentCode", "TR-CUP-0104", "name", "Uttara Futsal Knockout",
                    "venue", "Turf Nation Uttara", "date", "2026-08-29",
                    "format", "5_a_side", "entryFeeBdt", 3000, "prizePoolBdt", 25000,
                    "teamsRegistered", 8, "teamCapacity", 8, "privacy", "open"),
            Map.of("tournamentCode", "TR-CUP-0110", "name", "Corporate League Gulshan",
                    "venue", "Gulshan Sports Hub", "date", "2026-09-05",
                    "format", "6_a_side", "entryFeeBdt", 8000, "prizePoolBdt", 80000,
                    "teamsRegistered", 5, "teamCapacity", 12, "privacy", "invite_only"));

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "search_tournaments",
                "List upcoming tournaments, optionally filtered by format (5_a_side, 6_a_side, 7_a_side, knockout). Shows entry fee, prize pool and remaining team spots.",
                List.of(ToolParam.optional("format", "string", "Tournament format filter")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        Object format = arguments.get("format");
        List<Map<String, Object>> matches = TOURNAMENTS.stream()
                .filter(t -> format == null || format.toString().isBlank()
                        || t.get("format").equals(format.toString().trim()))
                .toList();
        return ToolResult.ok(Map.of("count", matches.size(), "tournaments", matches));
    }
}
