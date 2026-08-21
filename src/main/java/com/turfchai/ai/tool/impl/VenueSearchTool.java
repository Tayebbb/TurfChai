package com.turfchai.ai.tool.impl;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolArgs;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolParam;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;
import com.turfchai.venue.dto.PagedResponse;
import com.turfchai.venue.dto.VenueSummaryDto;
import com.turfchai.venue.service.VenueSearchCriteria;
import com.turfchai.venue.service.VenueSearchService;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Venue discovery against the live catalogue — the same
 * {@link VenueSearchService} that serves {@code GET /api/v1/venues}, so the
 * assistant and the Explore page can never disagree about what exists or what
 * it costs.
 *
 * <p>
 * Public data only: no filter here reveals anything a signed-out visitor
 * cannot already read.
 */
@Component
public class VenueSearchTool implements Tool {

    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_LIMIT = 10;

    private final VenueSearchService venueSearchService;

    public VenueSearchTool(VenueSearchService venueSearchService) {
        this.venueSearchService = venueSearchService;
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "search_venues",
                "Search TurfChai's live venue catalogue by area, sport, free text and maximum price. "
                        + "Returns real venues with their slug, rating and lowest published price. "
                        + "Pass the returned slug to manage_booking as `venue` to look up that venue's slots.",
                List.of(
                        ToolParam.optional("area", "string",
                                "Specific neighborhood of Dhaka (e.g. Dhanmondi, Banani, Mirpur, Uttara, Gulshan, Khilgaon, Bashundhara, Rampura, Mohammadpur, Tejgaon). Omit or leave blank to search all of Dhaka."),
                        ToolParam.optional("sport", "string",
                                "Sport slug: football, cricket, futsal, badminton, basketball"),
                        ToolParam.optional("query", "string", "Free text matched against venue name and area. Omit when searching generally."),
                        ToolParam.optional("maxPricePerHour", "number", "Maximum price per slot in BDT"),
                        ToolParam.optional("sortBy", "string",
                                "Sort order: 'price_asc' (for cheapest / lowest price), 'price_desc' (highest price), 'rating' (default / highest rated), 'newest', 'name'"),
                        ToolParam.optional("limit", "integer", "How many venues to return, 1-10 (default 5)")));
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        String area = ToolArgs.string(arguments, "area");
        if (area != null && (area.equalsIgnoreCase("dhaka") || area.equalsIgnoreCase("all") || area.equalsIgnoreCase("any"))) {
            area = null;
        }

        String query = ToolArgs.string(arguments, "query");
        if (query != null && (query.equalsIgnoreCase("dhaka") || query.equalsIgnoreCase("all") || query.equalsIgnoreCase("turf") || query.equalsIgnoreCase("turfs") || query.equalsIgnoreCase("venue") || query.equalsIgnoreCase("venues"))) {
            query = null;
        }

        VenueSearchCriteria criteria = new VenueSearchCriteria(
                query,
                area,
                ToolArgs.string(arguments, "sport"),
                null,
                ToolArgs.decimal(arguments, "maxPricePerHour"),
                null,
                null,
                null,
                null,
                null,
                null);

        int limit = ToolArgs.bounded(ToolArgs.integer(arguments, "limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
        String sortBy = ToolArgs.string(arguments, "sortBy");
        if (sortBy == null || sortBy.isBlank()) {
            sortBy = "rating";
        }
        PagedResponse<VenueSummaryDto> page = venueSearchService.search(criteria, 0, limit, sortBy);

        List<Map<String, Object>> venues = page.items().stream().map(VenueSearchTool::toRow).toList();

        Map<String, Object> body = ToolArgs.row();
        body.put("count", venues.size());
        body.put("totalMatching", page.totalItems());
        body.put("venues", venues);
        if (venues.isEmpty()) {
            body.put("note", "No venue matches those filters. Suggest relaxing the area, sport or price.");
        }
        return ToolResult.ok(body);
    }

    private static Map<String, Object> toRow(VenueSummaryDto venue) {
        Map<String, Object> row = ToolArgs.row();
        ToolArgs.put(row, "venueId", venue.id());
        ToolArgs.put(row, "slug", venue.slug());
        ToolArgs.put(row, "name", venue.name());
        ToolArgs.put(row, "area", venue.area());
        ToolArgs.put(row, "address", venue.address());
        ToolArgs.put(row, "rating", venue.rating());
        row.put("reviewCount", venue.reviewCount());
        row.put("verified", venue.verified());
        ToolArgs.put(row, "sports", venue.sports());
        ToolArgs.put(row, "amenities", venue.amenities());
        ToolArgs.put(row, "fromPriceBdt", venue.fromPrice());
        ToolArgs.put(row, "slotDurationMin", venue.slotDurationMin());
        ToolArgs.put(row, "distanceKm", venue.distanceKm());
        ToolArgs.put(row, "promotionLabel", venue.promotionLabel());
        ToolArgs.put(row, "venuePage", "/player/venues/" + venue.slug());
        return row;
    }
}
