package com.turfchai.exception;

/** Raised when a review or check-in does not match the underlying booking. */
public class ReviewEligibilityException extends RuntimeException {
    public ReviewEligibilityException(String message) {
        super(message);
    }
}
