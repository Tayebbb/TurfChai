package com.turfchai.ai.tool.mock;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Mock venue search. Replace with a Spring service-backed implementation
 * (VenueService) once backend APIs exist — the spec stays identical, so the
 * agent needs no changes.
 */
public class MockVenueSearchTool implements Tool {

    private static final List<Map<String, Object>> VENUES = List.of(
            venue("V-0044", "GreenTurf Arena", "Banani", List.of("football", "futsal"),
                    2500, 4.8, List.of("Floodlights", "Parking", "Changing Room")),
            venue("V-0051", "Kick Off Dhanmondi", "Dhanmondi", List.of("football"),
                    2000, 4.5, List.of("Floodlights", "Cafeteria")),
            venue("V-0062", "Turf Nation Uttara", "Uttara", List.of("football", "cricket"),
                    2200, 4.6, List.of("Parking", "Floodlights", "First Aid")),
            venue("V-0071", "Champion's Court Mirpur", "Mirpur", List.of("futsal", "badminton"),
                    1500, 4.3, List.of("Indoor", "AC", "Changing Room")),
            venue("V-0083", "Gulshan Sports Hub", "Gulshan", List.of("football", "basketball"),
                    3000, 4.9, List.of("Floodlights", "Parking", "Pro Shop", "Cafeteria")));

    private static Map<String, Object> venue(String id, String name, String area,
            List<String> sports, int pricePerHour,
            double rating, List<String> amenities) {
        return Map.of("venueId", id, "name", name, "area", area, "sports", sports,
                "pricePerHourBdt", pricePerHour, "rating", rating, "amenities", amenities);
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "search_venues",
                "Search turf venues by area, sport and maximum hourly price. Returns matching venues with price and rating.",
                List.of(
                        ToolParam.optional("area", "string",
                                "Area of Dhaka, e.g. Banani, Dhanmondi, Uttara, Mirpur, Gulshan"),
                        ToolParam.optional("sport", "string",
                                "Sport to play: football, cricket, futsal, badminton, basketball, volleyball"),
                        ToolParam.optional("maxPricePerHour", "number", "Maximum price per hour in BDT")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        String area = str(arguments.get("area"));
        String sport = str(arguments.get("sport"));
        Number maxPrice = arguments.get("maxPricePerHour") instanceof Number n ? n : null;

        List<Map<String, Object>> matches = VENUES.stream()
                .filter(v -> area == null || ((String) v.get("area")).equalsIgnoreCase(area))
                .filter(v -> sport == null || listContainsIgnoreCase(v.get("sports"), sport))
                .filter(v -> maxPrice == null || ((Integer) v.get("pricePerHourBdt")) <= maxPrice.intValue())
                .toList();

        return ToolResult.ok(Map.of("count", matches.size(), "venues", matches));
    }

    @SuppressWarnings("unchecked")
    private boolean listContainsIgnoreCase(Object list, String value) {
        return ((List<String>) list).stream()
                .anyMatch(s -> s.equalsIgnoreCase(value.toLowerCase(Locale.ROOT)));
    }

    private String str(Object value) {
        return value == null || value.toString().isBlank() ? null : value.toString().trim();
    }
}
