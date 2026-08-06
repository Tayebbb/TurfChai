package com.turfchai.exception;

/** Raised when a player tries to review the same booking more than once. */
public class ReviewAlreadyExistsException extends RuntimeException {
    public ReviewAlreadyExistsException() {
        super("A review has already been submitted for this booking.");
    }
}
