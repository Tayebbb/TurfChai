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

    /** Active users: status = 'ACTIVE' and not suspended. */
    @Query("SELECT COUNT(u) FROM User u WHERE u.status = 'ACTIVE' AND u.isSuspended = false")
    long countActiveUsers();

    // ── User segments ──────────────────────────────────────────────────────

    /** Players with status = 'ACTIVE'. */
    @Query("SELECT COUNT(u) FROM User u WHERE u.role IN (com.turfchai.model.enums.RoleType.PLAYER, com.turfchai.model.enums.RoleType.SOLO_PLAYER) AND u.status = 'ACTIVE'")
    long countActivePlayers();

    /** Hosts / owners with status = 'ACTIVE'. */
    @Query("SELECT COUNT(u) FROM User u WHERE u.role IN (com.turfchai.model.enums.RoleType.HOST, com.turfchai.model.enums.RoleType.OWNER) AND u.status = 'ACTIVE'")
    long countActiveHosts();

    /** Users with status NOT 'ACTIVE' (pending, suspended, deleted). */
    @Query("SELECT COUNT(u) FROM User u WHERE u.status <> 'ACTIVE'")
    long countInactiveUsers();
}
