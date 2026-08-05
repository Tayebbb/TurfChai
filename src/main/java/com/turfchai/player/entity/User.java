package com.turfchai.player.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * Minimal profile-side user model. Security columns (password hash, 2FA,
 * lockout) belong to the authentication task owned by another developer
 * and will extend this same table.
 */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Client-facing identifier; internal id never leaves the API. */
    @Column(nullable = false, unique = true)
    private UUID publicId = UUID.randomUUID();

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, unique = true, length = 160)
    private String email;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String area;

    @Column(length = 500)
    private String bio;

    @Column(length = 4)
    private String avatarInitials;

    /** 'beginner' | 'intermediate' | 'advanced' */
    @Column(length = 20)
    private String playStyle;

    /** 'captain' | 'solo' */
    @Column(length = 20)
    private String playerRole;

    /** Comma-separated sport slugs, e.g. "football,cricket". */
    @Column(length = 200)
    private String preferredSports;

    /** Comma-separated time windows, e.g. "evening,weekends". */
    @Column(length = 200)
    private String preferredTimes;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
