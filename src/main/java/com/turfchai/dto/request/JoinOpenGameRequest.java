package com.turfchai.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * The joining player is always the authenticated caller, taken from the token.
 * This used to demand a {@code userId} the service deliberately ignored, so a
 * request the UI sends honestly — without naming a victim to enrol — was
 * rejected as invalid and nobody could join a game at all.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JoinOpenGameRequest {

    private String paymentMethod;
}
