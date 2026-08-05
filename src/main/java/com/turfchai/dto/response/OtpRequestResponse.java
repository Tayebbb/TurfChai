package com.turfchai.dto.response;

public record OtpRequestResponse(
        boolean sent,
        String message,
        long ttlSeconds,
        String devCode
) {
}
