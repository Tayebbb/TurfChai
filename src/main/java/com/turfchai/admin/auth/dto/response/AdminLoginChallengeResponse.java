package com.turfchai.admin.auth.dto.response;

/**
 * Response of the first admin-login step. No token is issued — the caller must
 * complete {@code /admin/auth/login/verify} with the challenge and the code
 * delivered to the admin's inbox (or the {@code devCode} in demo mode).
 *
 * @param challenge  opaque id of the pending login challenge
 * @param sentTo     masked destination (email) the code was sent to
 * @param ttlSeconds validity window of the challenge
 * @param devCode    the code itself; only present when dev-code exposure is enabled
 * @param message    human-readable status message
 */
public record AdminLoginChallengeResponse(
        String challenge,
        String sentTo,
        long ttlSeconds,
        String devCode,
        String message
) {
}