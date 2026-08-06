package com.turfchai.dto.analytics;

import java.util.List;

/**
 * Response DTO for {@code GET /api/v1/admin/analytics/revenue}.
 * <p>
 * Carries GMV and booking-count series for the Admin Dashboard earnings chart.
 * Data points are month-aligned (or week-aligned) depending on the requested
 * timeframe.  For dev/demo the service always returns monthly data.
 * </p>
 */
public class RevenueDto {

    /** Human-readable period labels (e.g. "Jan", "Feb", …). */
    private List<String> labels;

    /**
     * Gross Merchandise Value per period, in BDT (Taka).
     * Aligned 1-to-1 with {@link #labels}.
     */
    private List<Long> gmv;

    /**
     * Total confirmed/paid booking count per period.
     * Aligned 1-to-1 with {@link #labels}.
     */
    private List<Long> bookings;

    /** Human-readable growth percentage string for the most recent period (e.g. "+24.6%"). */
    private String growthPercent;

    /** Cumulative GMV across all periods (BDT). */
    private long totalGmv;

    /** Cumulative bookings across all periods. */
    private long totalBookings;

    /** Share of sellable slots that were booked in the reporting window. */
    private double turfUtilizationPercent;

    // ── Constructors ──────────────────────────────────────────────────────

    public RevenueDto() {}

    public RevenueDto(List<String> labels, List<Long> gmv, List<Long> bookings,
                      String growthPercent, long totalGmv, long totalBookings) {
        this(labels, gmv, bookings, growthPercent, totalGmv, totalBookings, 0.0);
    }

    public RevenueDto(List<String> labels, List<Long> gmv, List<Long> bookings,
                      String growthPercent, long totalGmv, long totalBookings,
                      double turfUtilizationPercent) {
        this.labels = labels;
        this.gmv = gmv;
        this.bookings = bookings;
        this.growthPercent = growthPercent;
        this.totalGmv = totalGmv;
        this.totalBookings = totalBookings;
        this.turfUtilizationPercent = turfUtilizationPercent;
    }

    // ── Getters & setters ─────────────────────────────────────────────────

    public List<String> getLabels() { return labels; }
    public void setLabels(List<String> labels) { this.labels = labels; }

    public List<Long> getGmv() { return gmv; }
    public void setGmv(List<Long> gmv) { this.gmv = gmv; }

    public List<Long> getBookings() { return bookings; }
    public void setBookings(List<Long> bookings) { this.bookings = bookings; }

    public String getGrowthPercent() { return growthPercent; }
    public void setGrowthPercent(String growthPercent) { this.growthPercent = growthPercent; }

    public long getTotalGmv() { return totalGmv; }
    public void setTotalGmv(long totalGmv) { this.totalGmv = totalGmv; }

    public long getTotalBookings() { return totalBookings; }
    public void setTotalBookings(long totalBookings) { this.totalBookings = totalBookings; }

    public double getTurfUtilizationPercent() { return turfUtilizationPercent; }
    public void setTurfUtilizationPercent(double turfUtilizationPercent) { this.turfUtilizationPercent = turfUtilizationPercent; }
}
