package com.turfchai.repository;

import com.turfchai.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

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
}
