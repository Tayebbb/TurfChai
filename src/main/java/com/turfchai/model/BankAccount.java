package com.turfchai.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "bank_accounts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BankAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_user_id", nullable = false)
    private Long ownerUserId;

    @Column(name = "bank_name", nullable = false, length = 100)
    private String bankName;

    @Column(name = "account_name", nullable = false, length = 100)
    private String accountName;

    @Column(name = "account_number", nullable = false, length = 40)
    private String accountNumber;

    @Column(name = "routing_number", length = 20)
    private String routingNumber;

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private Boolean isPrimary = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
