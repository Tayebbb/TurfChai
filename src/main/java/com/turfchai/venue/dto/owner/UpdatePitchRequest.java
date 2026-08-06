package com.turfchai.venue.dto.owner;

import jakarta.validation.constraints.Size;

import java.util.List;

/** Payload for PUT /api/v1/owner/venues/{id}/pitches/{pitchId} — all fields nullable */
public record UpdatePitchRequest(
        @Size(max = 80) String name,
        @Size(max = 20) String format,
        @Size(max = 100) String surfaceType,
        @Size(max = 255) String surfaceDetail,
        @Size(max = 40) String dimensions,
        @Size(max = 120) String lighting,
        Integer maxPlayers,
        Boolean indoor,
        Boolean active,
        List<String> sportSlugs
) {}
