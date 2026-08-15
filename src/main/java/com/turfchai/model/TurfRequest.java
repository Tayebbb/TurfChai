package com.turfchai.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "turf_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TurfRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_code", nullable = false, unique = true, length = 12)
    private String requestCode;

    @Column(name = "venue_id")
    private Long venueId;

    @Column(name = "owner_user_id", nullable = false)
    private Long ownerUserId;

    @Column(name = "venue_name", nullable = false, length = 120)
    private String venueName;

    @Column(nullable = false, length = 100)
    private String area;

    @Column(name = "pitch_count", nullable = false)
    @Builder.Default
    private Integer pitchCount = 1;

    @Column(name = "sports_csv", length = 255)
    private String sportsCsv;

    @Column(name = "owner_phone", length = 20)
    private String ownerPhone;

    @Column(name = "owner_email", length = 150)
    private String ownerEmail;

    @Column(name = "doc_trade_license", nullable = false, length = 500)
    @Builder.Default
    private String docTradeLicense = "PENDING";

    @Column(name = "doc_owner_nid", nullable = false, length = 500)
    @Builder.Default
    private String docOwnerNid = "PENDING";

    @Column(name = "doc_utility_bill", nullable = false, length = 500)
    @Builder.Default
    private String docUtilityBill = "PENDING";

    @Column(name = "photos_json", columnDefinition = "TEXT")
    private String photosJson;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "admin_note")
    private String adminNote;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private OffsetDateTime reviewedAt;

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
