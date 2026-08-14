package com.turfchai.tournament.service;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
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
            @NotBlank @Pattern(regexp = "5_a_side|6_a_side|7_a_side|knockout",
                    message = "must be one of 5_a_side, 6_a_side, 7_a_side, knockout") String format,
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

    /**
     * @param repeatWeeks how many consecutive weeks the slot pattern repeats,
     *                    counting the tournament date itself. Null means one.
     */
    public record ReserveSlotsRequest(@NotEmpty List<@Valid SlotRequest> slots,
                                      @Min(1) @Max(26) Integer repeatWeeks) {

        /** Single-week reservation — the default before a recurrence is chosen. */
        public ReserveSlotsRequest(List<SlotRequest> slots) {
            this(slots, null);
        }

        public int weeks() {
            return repeatWeeks == null ? 1 : repeatWeeks;
        }
    }

    /**
     * Confirms the bulk reservation and records the deposit. The amount is
     * always computed server-side, so the client cannot name its own price.
     */
    public record PayDepositRequest(
            @Min(1) @Max(26) Integer repeatWeeks,
            @NotBlank @Pattern(regexp = "bKash|Nagad|Card|Bank transfer",
                    message = "must be one of bKash, Nagad, Card, Bank transfer") String method,
            @Size(max = 60) String payerReference) {

        public int weeks() {
            return repeatWeeks == null ? 1 : repeatWeeks;
        }
    }

    /** Player-facing registration for a tournament. */
    public record RegisterPlayerRequest(
            @NotBlank @Size(max = 100) String teamName,
            @Size(max = 100) String captainName,
            @Size(max = 20) String contactPhone,
            @Size(max = 120) String emergencyContact,
            @Size(max = 8) String jerseyNumber,
            @Pattern(regexp = "BEGINNER|INTERMEDIATE|ADVANCED|ALL_LEVELS|") String skillLevel,
            @Size(max = 500) String medicalNotes,
            @AssertTrue(message = "must accept the tournament rules") boolean agreedToRules) {
    }
}
