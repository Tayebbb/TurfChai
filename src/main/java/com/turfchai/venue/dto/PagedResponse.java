package com.turfchai.venue.dto;

import java.util.List;

/** Stable page envelope so the frontend isn't coupled to Spring's Page shape. */
public record PagedResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages) {
}
