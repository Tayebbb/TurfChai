package com.turfchai.tournament.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/** Read models returned by the tournament API. */
public final class TournamentViews {

    private TournamentViews() {
    }

    public record TeamView(Long id, String name, String captainName,
                           String entryFeeStatus, BigDecimal entryFeePaid,
                           String registrationCode) {
    }

    /** Compact card for browse feeds and the player's tournament history. */
    public record TournamentCard(String code, String name, String venueSlug, String venueName,
                                 LocalDate date, LocalTime windowStart, LocalTime windowEnd,
                                 String format, String privacy, String status,
                                 int teamCapacity, int registeredTeams, int spotsLeft,
                                 BigDecimal entryFeePerTeam, BigDecimal prizePool,
                                 String myRegistrationCode, String myPaymentStatus) {
    }

    public record FixtureView(Long id, String roundLabel, int matchNumber,
                              String pitchName, LocalTime startTime,
                              String teamA, String teamB, String status) {
    }

    public record ReservationView(Long id, Long pitchId, String pitchName,
                                  LocalDate slotDate, LocalTime startTime,
                                  LocalTime endTime, BigDecimal price) {
    }

    /** Cost roll-up shown on the dashboard and reserve checkout. */
    public record CostSummary(int slotCount, BigDecimal slotTotal, BigDecimal discount,
                              BigDecimal total, BigDecimal deposit, BigDecimal balance) {
    }

    public record TournamentView(Long id, String code, String name,
                                 String venueSlug, String venueName,
                                 LocalDate date, LocalTime windowStart, LocalTime windowEnd,
                                 String format, int teamCapacity, BigDecimal entryFeePerTeam,
                                 BigDecimal prizePool, String privacy, String inviteCode,
                                 String status, LocalDate balanceDueDate,
                                 List<TeamView> teams, List<FixtureView> fixtures,
                                 List<ReservationView> reservations, CostSummary costs) {
    }
}
