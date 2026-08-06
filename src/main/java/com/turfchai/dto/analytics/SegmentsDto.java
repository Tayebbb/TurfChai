package com.turfchai.dto.analytics;

/**
 * Response DTO for {@code GET /api/v1/admin/analytics/segments}.
 * <p>
 * Carries user-segment breakdown KPIs for the Admin {@code UserSegmentsPage}
 * donut chart and stats cards.
 * </p>
 */
public class SegmentsDto {

    /** Active players (role = 'player', status = 'active'). */
    private long playerCount;

    /** Registered venue hosts/owners (role IN ('host','owner'), status = 'active'). */
    private long hostCount;

    /** Inactive accounts (no booking activity in 30 days, or status ≠ 'active'). */
    private long inactiveCount;

    /** Total registered users (all roles, all statuses). */
    private long totalUsers;

    /**
     * Average lifetime GMV per user in BDT (total booking revenue / total users).
     * Formatted as a long (whole taka) for simplicity.
     */
    private long avgLifetimeValueBdt;

    // ── Constructors ──────────────────────────────────────────────────────

    public SegmentsDto() {}

    public SegmentsDto(long playerCount, long hostCount,
                       long inactiveCount, long totalUsers,
                       long avgLifetimeValueBdt) {
        this.playerCount = playerCount;
        this.hostCount = hostCount;
        this.inactiveCount = inactiveCount;
        this.totalUsers = totalUsers;
        this.avgLifetimeValueBdt = avgLifetimeValueBdt;
    }

    // ── Getters & setters ─────────────────────────────────────────────────

    public long getPlayerCount() { return playerCount; }
    public void setPlayerCount(long playerCount) { this.playerCount = playerCount; }

    public long getHostCount() { return hostCount; }
    public void setHostCount(long hostCount) { this.hostCount = hostCount; }

    public long getInactiveCount() { return inactiveCount; }
    public void setInactiveCount(long inactiveCount) { this.inactiveCount = inactiveCount; }

    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }

    public long getAvgLifetimeValueBdt() { return avgLifetimeValueBdt; }
    public void setAvgLifetimeValueBdt(long avgLifetimeValueBdt) { this.avgLifetimeValueBdt = avgLifetimeValueBdt; }
}
