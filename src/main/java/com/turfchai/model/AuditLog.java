package com.turfchai.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_name", nullable = false, length = 100)
    private String adminName;

    @Column(name = "admin_id")
    private Long adminId;

    @Column(name = "action", nullable = false, length = 100)
    private String action;

    @Column(name = "action_tone", length = 30)
    @Builder.Default
    private String actionTone = "blue";

    @Column(name = "target", length = 100)
    private String target;

    @Column(name = "details", length = 500)
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}
