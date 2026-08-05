package com.turfchai.model;

import com.turfchai.model.enums.OpenGameStatus;
import com.turfchai.model.enums.SkillLevel;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "open_games")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OpenGame {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_code", nullable = false, unique = true, length = 14)
    @Builder.Default
    private String gameCode = "OG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

    @NotBlank
    @Column(name = "title", nullable = false, length = 150)
    private String title;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pitch_id")
    private Pitch pitch;

    @NotNull
    @Column(name = "game_date", nullable = false)
    private LocalDate gameDate;

    @NotNull
    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @NotNull
    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "skill_level", nullable = false)
    @Builder.Default
    private SkillLevel skillLevel = SkillLevel.ALL_LEVELS;

    @Min(2)
    @Max(50)
    @Column(name = "capacity", nullable = false)
    private Integer capacity;

    @Min(0)
    @Column(name = "filled_count", nullable = false)
    @Builder.Default
    private Integer filledCount = 0;

    @NotNull
    @Min(0)
    @Column(name = "price_per_player", nullable = false, precision = 12, scale = 2)
    private BigDecimal pricePerPlayer;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organizer_user_id", nullable = false)
    private User organizer;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private OpenGameStatus status = OpenGameStatus.OPEN;

    @Min(0)
    @Max(100)
    @Column(name = "minimum_reliability", nullable = false)
    @Builder.Default
    private Integer minimumReliability = 90;

    @OneToMany(mappedBy = "openGame", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OpenGameMembership> memberships = new ArrayList<>();

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

    public void updateStatusBasedOnCapacity() {
        if (filledCount >= capacity) {
            this.status = OpenGameStatus.FULL;
        } else if (filledCount >= capacity - 2) {
            this.status = OpenGameStatus.ALMOST_FULL;
        } else if (this.status == OpenGameStatus.FULL || this.status == OpenGameStatus.ALMOST_FULL) {
            this.status = OpenGameStatus.OPEN;
        }
    }
}
