package com.turfchai.tournament.service;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Request payloads for the tournament API. */
public final class TournamentRequests {

    private TournamentRequests() {
    }

    public record CreateTournamentRequest(
            @NotBlank @Size(max = 150) String name,
            @NotBlank String venueSlug,
            @NotNull LocalDate date,
            @NotNull LocalTime windowStart,
            @NotNull LocalTime windowEnd,
            @NotBlank @Pattern(regexp = "5_a_side|6_a_side|7_a_side|9_a_side|knockout") String format,
            @Min(2) @Max(64) int teamCapacity,
            @NotNull @DecimalMin("0") BigDecimal entryFeePerTeam,
            @DecimalMin("0") BigDecimal prizePool,
            @Pattern(regexp = "open|invite_only") String privacy) {
    }

    public record RegisterTeamRequest(
            @NotBlank @Size(max = 100) String name,
            @Size(max = 100) String captainName) {
    }

    public record SlotRequest(
            @NotNull Long pitchId,
            @NotNull LocalTime startTime,
            @NotNull LocalTime endTime) {
    }

    public record ReserveSlotsRequest(@NotEmpty List<@Valid SlotRequest> slots) {
    }
}
