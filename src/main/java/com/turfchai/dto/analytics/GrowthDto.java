package com.turfchai.dto.analytics;

import java.util.List;

/**
 * Response DTO for {@code GET /api/v1/admin/analytics/growth}.
 * <p>
 * Carries KPI metrics and a 7-day daily signup series for the
 * Admin {@code UserGrowthPage} chart.
 * </p>
 */
public class GrowthDto {

    /** Total registered users (all time). */
    private long totalUsers;

    /** New signups in the last 24 hours. */
    private long newUsersToday;

    /**
     * Ratio of active users (non-deleted, non-suspended) to total,
     * expressed as a percentage (0–100).
     */
    private double activeRatio;

    /**
     * 30-day user return rate expressed as a percentage.
     * Derived from bookings: users who booked in both the prior period
     * and the current period.
     */
    private double retentionRate;

    /** Day-of-week labels for the signup chart (e.g. "Mon", "Tue", …). */
    private List<String> signupLabels;

    /** Daily new-user counts aligned with {@link #signupLabels}. */
    private List<Long> signupCounts;

    // ── Constructors ──────────────────────────────────────────────────────

    public GrowthDto() {}

    public GrowthDto(long totalUsers, long newUsersToday,
                     double activeRatio, double retentionRate,
                     List<String> signupLabels, List<Long> signupCounts) {
        this.totalUsers = totalUsers;
        this.newUsersToday = newUsersToday;
        this.activeRatio = activeRatio;
        this.retentionRate = retentionRate;
        this.signupLabels = signupLabels;
        this.signupCounts = signupCounts;
    }

    // ── Getters & setters ─────────────────────────────────────────────────

    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }

    public long getNewUsersToday() { return newUsersToday; }
    public void setNewUsersToday(long newUsersToday) { this.newUsersToday = newUsersToday; }

    public double getActiveRatio() { return activeRatio; }
    public void setActiveRatio(double activeRatio) { this.activeRatio = activeRatio; }

    public double getRetentionRate() { return retentionRate; }
    public void setRetentionRate(double retentionRate) { this.retentionRate = retentionRate; }

    public List<String> getSignupLabels() { return signupLabels; }
    public void setSignupLabels(List<String> signupLabels) { this.signupLabels = signupLabels; }

    public List<Long> getSignupCounts() { return signupCounts; }
    public void setSignupCounts(List<Long> signupCounts) { this.signupCounts = signupCounts; }
}
