package com.turfchai.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Entity
@Table(name = "venues")
@Getter
@Setter
public class Venue {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "rating_avg", precision = 3, scale = 2, nullable = false)
    private BigDecimal ratingAvg = BigDecimal.ZERO;

    @Column(name = "review_count", nullable = false)
    private Integer reviewCount = 0;

    // other fields omitted for brevity
}
