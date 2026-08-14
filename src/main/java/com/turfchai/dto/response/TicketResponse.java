package com.turfchai.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

/**
 * A player's gate pass for one open game.
 *
 * <p>{@code checkInToken} is the signed payload the QR code carries; every
 * other field is display copy for the ticket itself.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketResponse {
    private Long gameId;
    private String gameCode;
    private String ticketCode;
    private String title;
    private String venueName;
    private String pitchName;
    private String area;
    private LocalDate gameDate;
    private LocalTime startTime;
    private LocalTime endTime;
    private String skillLevel;
    private BigDecimal pricePerPlayer;
    private Integer capacity;
    private Integer filledCount;
    private String organizerName;

    private Long holderUserId;
    private String holderName;
    private String membershipStatus;
    private Boolean checkedIn;

    private String checkInToken;
    private Instant validFrom;
    private Instant validUntil;
}
