package com.turfchai.exception;

/**
 * The pricing model itself could not be consulted (model file missing, ONNX
 * runtime failure). This is a dependency outage, not a client mistake, so it
 * must not be reported as a 400 — nor as a bare 500 with an empty body, which
 * tells the caller nothing about whether retrying is worthwhile.
 */
public class PricingUnavailableException extends RuntimeException {

    public PricingUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
