package com.turfchai.dto.analytics;

/**
 * One row of the admin "Player Classification" breakdown.
 *
 * @param id    stable key (e.g. "power")
 * @param title display name (e.g. "Power Players")
 * @param note  the usage threshold that defines the tier
 * @param count number of players in this tier
 * @param share percentage share of active players (0–100)
 */
public record PlayerTierDto(String id, String title, String note, long count, double share) {
}