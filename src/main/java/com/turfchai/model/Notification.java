package com.turfchai.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

// ponytail: userId is a plain Long, not a @ManyToOne. Avoids lazy-load traps for a write-heavy table.
// ceiling: add User relation if you need to JOIN-fetch user data in notification queries.
@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 30)
    private String type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column
    private String body;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private Boolean isRead = false;

    @Column(length = 255)
    private String link;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
