package com.turfchai.dto.analytics;

/**
 * One row of the admin "Engagement Cohort Overview" table.
 *
 * @param id                  stable key (e.g. "power")
 * @param cohort              display name (e.g. "Power Players")
 * @param users               number of users in the cohort
 * @param avgBookingsPerMonth average confirmed bookings per user over the last 30 days
 * @param retentionRate       share (%) of cohort members active last month who were also
 *                            active the month before; {@code null} when not meaningful (e.g. new signups)
 * @param avgSpend            average confirmed GMV in BDT per user over the last 30 days
 * @param ltv                 average lifetime confirmed GMV in BDT per user
 */
public record CohortDto(String id, String cohort, long users,
                        double avgBookingsPerMonth, Double retentionRate,
                        long avgSpend, long ltv) {
}