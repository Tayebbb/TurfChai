package com.turfchai.repository;

import com.turfchai.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.ZonedDateTime;

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
    long countNewUsersInPeriod(@Param("from") ZonedDateTime from,
                               @Param("to") ZonedDateTime to);

    /** Active users: status = 'active' and not suspended. */
    @Query("SELECT COUNT(u) FROM User u WHERE u.status = 'active' AND u.isSuspended = false")
    long countActiveUsers();

    // ── User segments ──────────────────────────────────────────────────────

    /** Players with status = 'active'. */
    @Query("SELECT COUNT(u) FROM User u WHERE u.role = 'player' AND u.status = 'active'")
    long countActivePlayers();

    /** Hosts / owners with status = 'active'. */
    @Query("SELECT COUNT(u) FROM User u WHERE u.role IN ('host', 'owner') AND u.status = 'active'")
    long countActiveHosts();

    /** Users with status NOT 'active' (pending, suspended, deleted). */
    @Query("SELECT COUNT(u) FROM User u WHERE u.status <> 'active'")
    long countInactiveUsers();
}
