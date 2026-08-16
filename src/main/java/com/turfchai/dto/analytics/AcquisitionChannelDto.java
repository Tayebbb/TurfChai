package com.turfchai.dto.analytics;

/**
 * One row of the admin "Acquisition Channels" breakdown.
 *
 * @param id             stable key (e.g. "organic")
 * @param channel        display name (e.g. "Organic Search")
 * @param newUsers       number of registered users acquired via this channel
 * @param conversionRate percentage of channel users who placed at least one booking (0–100)
 * @param cac            customer-acquisition cost in BDT as a display string, or "—"
 *                       when no marketing spend data is tracked
 */
public record AcquisitionChannelDto(String id, String channel, long newUsers,
                                    double conversionRate, String cac) {
}