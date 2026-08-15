package com.turfchai.service;

import com.turfchai.domain.Review;
import com.turfchai.repository.ReviewRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OwnerReviewService {

    private final VenueRepository venueRepository;
    private final ReviewRepository reviewRepository;

    public Map<String, Object> getReviewsSummary(Long ownerUserId) {
        List<Venue> ownerVenues = venueRepository.findByOwnerId(ownerUserId);
        if (ownerVenues.isEmpty()) {
            return emptySummary();
        }

        String venueSlug = ownerVenues.get(0).getSlug();
        List<Long> venueIds = ownerVenues.stream().map(Venue::getId).toList();
        List<Review> reviews = reviewRepository.findByVenueIdInOrderByCreatedAtDesc(venueIds);

        if (reviews.isEmpty()) {
            return emptySummaryWithSlug(venueSlug);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        int[] starCounts = new int[5];
        double totalRating = 0.0;

        Map<String, Double> catTotals = new HashMap<>();
        Map<String, Integer> catCounts = new HashMap<>();

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM d, yyyy");

        for (Review r : reviews) {
            String customerName = (r.getUser() != null && r.getUser().getFullName() != null && !r.getUser().getFullName().isBlank())
                    ? r.getUser().getFullName()
                    : "Guest User";
            String initials = !customerName.isEmpty() ? customerName.substring(0, 1).toUpperCase() : "?";

            Integer overall = r.getOverallRating() != null ? r.getOverallRating() : 0;
            if (overall >= 1 && overall <= 5) {
                starCounts[overall - 1]++;
            }
            totalRating += overall;

            if (r.getSubRatings() != null) {
                for (Map.Entry<String, Integer> entry : r.getSubRatings().entrySet()) {
                    catTotals.put(entry.getKey(), catTotals.getOrDefault(entry.getKey(), 0.0) + entry.getValue());
                    catCounts.put(entry.getKey(), catCounts.getOrDefault(entry.getKey(), 0) + 1);
                }
            }

            Map<String, Object> item = new HashMap<>();
            item.put("id", r.getId() != null ? r.getId().toString() : java.util.UUID.randomUUID().toString());
            item.put("author", customerName);
            item.put("customer", customerName);
            item.put("initials", initials);
            item.put("avatarTone", "brand");
            item.put("rating", overall);
            item.put("subtitle", (r.getVenue() != null ? r.getVenue().getName() : "") + (r.getCreatedAt() != null ? " · " + r.getCreatedAt().format(formatter) : ""));
            item.put("date", r.getCreatedAt() != null ? r.getCreatedAt().format(formatter) : "N/A");
            item.put("text", r.getComment() != null ? r.getComment() : "");
            item.put("comment", r.getComment() != null ? r.getComment() : "");
            item.put("tags", r.getTags() != null ? r.getTags() : List.of());
            item.put("needsResponse", false);

            items.add(item);
        }

        List<Map<String, Object>> ratingBreakdown = new ArrayList<>();
        for (int i = 5; i >= 1; i--) {
            int count = starCounts[i - 1];
            int pct = reviews.size() > 0 ? (int) Math.round((count * 100.0) / reviews.size()) : 0;
            ratingBreakdown.add(Map.of("star", i, "stars", i, "pct", pct, "count", count, "width", pct + "%"));
        }

        List<Map<String, Object>> categoryAverages = new ArrayList<>();
        for (String cat : catTotals.keySet()) {
            double avg = catTotals.get(cat) / catCounts.get(cat);
            categoryAverages.add(Map.of("id", cat, "label", capitalize(cat), "value", String.format("%.1f", avg)));
        }

        String averageRating = reviews.size() > 0 ? String.format("%.1f", totalRating / reviews.size()) : "0.0";

        return Map.of(
                "venueSlug", venueSlug,
                "items", items,
                "ratingBreakdown", ratingBreakdown,
                "categoryAverages", categoryAverages,
                "averageRating", averageRating,
                "totalReviews", reviews.size()
        );
    }

    private String capitalize(String str) {
        if (str == null || str.isEmpty()) return str;
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }

    private Map<String, Object> emptySummary() {
        return emptySummaryWithSlug(null);
    }

    private Map<String, Object> emptySummaryWithSlug(String venueSlug) {
        Map<String, Object> res = new HashMap<>();
        if (venueSlug != null) {
            res.put("venueSlug", venueSlug);
        }
        res.put("items", List.of());
        res.put("ratingBreakdown", List.of(
                Map.of("star", 5, "stars", 5, "pct", 0, "count", 0, "width", "0%"),
                Map.of("star", 4, "stars", 4, "pct", 0, "count", 0, "width", "0%"),
                Map.of("star", 3, "stars", 3, "pct", 0, "count", 0, "width", "0%"),
                Map.of("star", 2, "stars", 2, "pct", 0, "count", 0, "width", "0%"),
                Map.of("star", 1, "stars", 1, "pct", 0, "count", 0, "width", "0%")
        ));
        res.put("categoryAverages", List.of());
        res.put("averageRating", "0.0");
        res.put("totalReviews", 0);
        return res;
    }
}
