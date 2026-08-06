package com.turfchai.model;

import com.turfchai.model.enums.RoleType;
import com.turfchai.model.enums.SkillLevel;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_id", nullable = false, unique = true)
    @Builder.Default
    private String publicId = UUID.randomUUID().toString();

    @NotBlank
    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @NotBlank
    @Email
    @Column(name = "email", nullable = false, unique = true, length = 150)
    private String email;

    @NotBlank
    @Column(name = "phone", nullable = false, unique = true, length = 20)
    private String phone;

    @NotBlank
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "two_factor_enabled", nullable = false)
    @Builder.Default
    private Boolean twoFactorEnabled = false;

    @Column(name = "two_factor_secret")
    private String twoFactorSecret;

    @Column(name = "failed_login_count", nullable = false)
    @Builder.Default
    private Integer failedLoginCount = 0;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    @Builder.Default
    private RoleType role = RoleType.PLAYER;

    @Column(name = "status", nullable = false)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "area", length = 100)
    private String area;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "avatar_initials", length = 4)
    private String avatarInitials;

    @Column(name = "bio")
    private String bio;

    @Min(0)
    @Max(100)
    @Column(name = "reliability_score", nullable = false)
    @Builder.Default
    private Integer reliabilityScore = 100;

    @Column(name = "games_attended", nullable = false)
    @Builder.Default
    private Integer gamesAttended = 0;

    @Column(name = "games_no_show", nullable = false)
    @Builder.Default
    private Integer gamesNoShow = 0;

    @Column(name = "is_suspended", nullable = false)
    @Builder.Default
    private Boolean isSuspended = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "play_style")
    private SkillLevel playStyle;

    // Player-profile fields (profile module). CSV columns are the interim
    // representation until the array/JSONB baseline columns get mapped types.
    @Column(name = "player_role", length = 30)
    private String playerRole;

    @Column(name = "preferred_sports_csv")
    private String preferredSports;

    @Column(name = "preferred_times_csv")
    private String preferredTimes;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    @PreUpdate
    public void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }
}
