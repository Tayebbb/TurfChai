package com.turfchai.exception;

/**
 * Raised when a review cannot be resolved for the caller.
 *
 * <p>Also raised when the review exists but belongs to a venue the caller does not
 * own, so that review ids of other venues cannot be probed through the response
 * status.
 */
public class ReviewNotFoundException extends RuntimeException {
    public ReviewNotFoundException(Long id) {
        super("Review not found: " + id);
    }
}
