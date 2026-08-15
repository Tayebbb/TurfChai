package com.turfchai.dto.analytics;

/**
 * One row of the admin "Host Status Breakdown" table.
 *
 * @param id                 stable key (e.g. "active")
 * @param status             display label (e.g. "Active")
 * @param tone               UI badge tone: green / amber / red
 * @param count              number of hosts in this state
 * @param avgRevenuePerMonth average confirmed venue GMV in BDT over the last 30 days per host
 * @param share              percentage share of all hosts (0–100)
 */
public record HostStatusRowDto(String id, String status, String tone,
                               long count, long avgRevenuePerMonth, double share) {
}