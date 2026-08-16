package com.turfchai.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * A single bookable time slot, as shown on the venue page's availability grid.
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SlotResponse {
    private Long id;
    private Long pitchId;
    private String pitchName;
    private LocalDate slotDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private BigDecimal price;
    private String status;

    /**
     * Whether this slot can actually be bought right now. A slot that is
     * AVAILABLE but whose start time has passed is not bookable, and the
     * booking engine will refuse it — clients must gate the CTA on this
     * rather than on {@code status} alone.
     */
    private boolean bookable;

    /**
     * True only when {@code status} is HELD and the hold belongs to the
     * caller. Lets a player who navigated away mid-checkout (back button,
     * closed tab) click back into their own held slot instead of hitting a
     * disabled "Held" cell with no way back to checkout. Never true for an
     * anonymous caller or a hold owned by someone else.
     */
    private boolean heldByMe;
}
