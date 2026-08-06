package com.turfchai.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.ZonedDateTime;

/**
 * Represents any platform actor (player, host, owner, admin, super_admin).
 * Only the columns required by the existing entities and analytics queries
 * are mapped here; the full schema is in DATABASE_SCHEMA.md.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "role", nullable = false)
    private String role = "player";

    @Column(name = "status", nullable = false)
    private String status = "active";

    @Column(name = "is_suspended", nullable = false)
    private boolean isSuspended = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private ZonedDateTime createdAt = ZonedDateTime.now();
}
