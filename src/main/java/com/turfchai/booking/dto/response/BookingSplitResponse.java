package com.turfchai.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSplitResponse {

    private Long bookingId;
    private Boolean splitEnabled;
    private OffsetDateTime splitDeadline;
    private BigDecimal totalAmount;
    private BigDecimal splitTotalPaid;
    private BigDecimal splitRemaining;
    private Integer totalPlayers;
    private Integer paidCount;
    private Integer pendingCount;
    private BigDecimal shareAmount;
    private List<BookingMemberResponse> members;
    private Long openGameId;
}
