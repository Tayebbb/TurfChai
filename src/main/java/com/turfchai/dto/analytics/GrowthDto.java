package com.turfchai.dto.analytics;

import java.util.ArrayList;
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
    private Double retentionRate;

    /** Day-of-week labels for the signup chart (e.g. "Mon", "Tue", …). */
    private List<String> signupLabels;

    /** Daily new-user counts aligned with {@link #signupLabels}. */
    private List<Long> signupCounts;

    /** Month labels for the 6-month growth chart (e.g. "Mar", "Apr", ...). */
    private List<String> growthMonths;

    /** Monthly new player counts for the 6-month growth chart. */
    private List<Long> growthPlayers;

    /** Monthly new host counts for the 6-month growth chart. */
    private List<Long> growthHosts;

    /** Acquisition-channel breakdown (new users, conversion, CAC). */
    private List<AcquisitionChannelDto> channels = new ArrayList<>();

    // ── Constructors ──────────────────────────────────────────────────────

    public GrowthDto() {}

    public GrowthDto(long totalUsers, long newUsersToday,
                     double activeRatio, Double retentionRate,
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

    public Double getRetentionRate() { return retentionRate; }
    public void setRetentionRate(Double retentionRate) { this.retentionRate = retentionRate; }

    public List<String> getSignupLabels() { return signupLabels; }
    public void setSignupLabels(List<String> signupLabels) { this.signupLabels = signupLabels; }

    public List<Long> getSignupCounts() { return signupCounts; }
    public void setSignupCounts(List<Long> signupCounts) { this.signupCounts = signupCounts; }

    public List<String> getGrowthMonths() { return growthMonths; }
    public void setGrowthMonths(List<String> growthMonths) { this.growthMonths = growthMonths; }

    public List<Long> getGrowthPlayers() { return growthPlayers; }
    public void setGrowthPlayers(List<Long> growthPlayers) { this.growthPlayers = growthPlayers; }

    public List<Long> getGrowthHosts() { return growthHosts; }
    public void setGrowthHosts(List<Long> growthHosts) { this.growthHosts = growthHosts; }

    public List<AcquisitionChannelDto> getChannels() { return channels; }
    public void setChannels(List<AcquisitionChannelDto> channels) { this.channels = channels; }
}
