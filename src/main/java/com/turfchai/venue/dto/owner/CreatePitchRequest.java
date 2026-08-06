package com.turfchai.venue.dto.owner;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Payload for POST /api/v1/owner/venues/{id}/pitches */
public record CreatePitchRequest(

        @NotBlank @Size(max = 80)
        String name,

        /** e.g. '5_a_side', '7_a_side', '11_a_side' */
        @Size(max = 20)
        String format,

        @Size(max = 100)
        String surfaceType,

        @Size(max = 255)
        String surfaceDetail,

        @Size(max = 40)
        String dimensions,

        @Size(max = 120)
        String lighting,

        @Min(2)
        Integer maxPlayers,

        boolean indoor,

        /** List of sport slugs, e.g. ["football","futsal"] */
        List<String> sportSlugs
) {}
