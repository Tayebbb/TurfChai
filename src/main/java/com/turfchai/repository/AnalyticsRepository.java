package com.turfchai.repository;

import com.turfchai.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.List;

/**
 * Aggregation queries supporting admin analytics endpoints.
 * <p>
 * All queries run against the {@code users} and {@code bookings} tables.
 * They use JPQL so they are dialect-agnostic (H2 and PostgreSQL both work).
 * </p>
 */
public interface AnalyticsRepository extends JpaRepository<User, Long> {

    // ── User growth ────────────────────────────────────────────────────────

    /** Total number of users registered on the platform (all statuses). */
    @Query("SELECT COUNT(u) FROM User u")
    long countTotalUsers();

    /**
     * Number of users whose {@code createdAt} falls within the given window.
     * Used for daily / weekly new-registration counts.
     */
    @Query("SELECT COUNT(u) FROM User u WHERE u.createdAt >= :from AND u.createdAt < :to")
    long countNewUsersInPeriod(@Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);

    /** Active users: status = 'ACTIVE' (or 'active') and not suspended. */
    @Query("SELECT COUNT(u) FROM User u WHERE UPPER(u.status) = 'ACTIVE' AND u.isSuspended = false")
    long countActiveUsers();

    // ── User segments ──────────────────────────────────────────────────────

    /** Players with status = 'ACTIVE' (or 'active'). */
    @Query("SELECT COUNT(u) FROM User u WHERE u.role = com.turfchai.model.enums.RoleType.PLAYER AND UPPER(u.status) = 'ACTIVE'")
    long countActivePlayers();

    /** Hosts / owners with status = 'ACTIVE' (or 'active'). */
    @Query("SELECT COUNT(u) FROM User u WHERE (u.role = com.turfchai.model.enums.RoleType.HOST OR u.role = com.turfchai.model.enums.RoleType.OWNER) AND UPPER(u.status) = 'ACTIVE'")
    long countActiveHosts();

    /** Users with status NOT 'ACTIVE' or suspended. */
    @Query("SELECT COUNT(u) FROM User u WHERE UPPER(u.status) <> 'ACTIVE' OR u.isSuspended = true")
    long countInactiveUsers();

    /**
     * PostgreSQL aggregation for the admin revenue chart.  Native SQL is used
     * here because date_trunc is both more efficient and less error-prone than
     * grouping timestamps in Java.
     */
    @Query(value = """
            SELECT date_trunc('month', b.created_at) AS period,
                   COALESCE(SUM(b.net_amount), 0) AS gmv,
                   COUNT(*) AS booking_count
            FROM bookings b
            WHERE b.created_at >= :from
              AND b.status IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'COMPLETED')
            GROUP BY date_trunc('month', b.created_at)
            ORDER BY period
            """, nativeQuery = true)
    List<Object[]> findMonthlyRevenue(@Param("from") OffsetDateTime from);

    @Query(value = """
            SELECT COALESCE(SUM(b.net_amount), 0)
            FROM bookings b
            WHERE b.status IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'COMPLETED')
            """, nativeQuery = true)
    BigDecimal sumBookingRevenue();

    /** Percentage of sellable slots booked during the supplied window. */
    @Query(value = """
            SELECT COALESCE(
                100.0 * COUNT(DISTINCT b.slot_id) / NULLIF(COUNT(DISTINCT s.id), 0), 0
            )
            FROM slots s
            LEFT JOIN bookings b ON b.slot_id = s.id
                AND b.status IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID', 'COMPLETED')
            WHERE s.slot_date >= CAST(:from AS DATE) AND s.slot_date < CAST(:to AS DATE)
            """, nativeQuery = true)
    Double calculateTurfUtilization(@Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);
}
