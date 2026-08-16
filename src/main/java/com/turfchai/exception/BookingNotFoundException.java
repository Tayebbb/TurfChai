package com.turfchai.exception;

/**
 * A booking the caller cannot be shown.
 *
 * Deliberately raised both when the booking does not exist and when it exists
 * but belongs to someone else, so the two are indistinguishable and the id
 * space cannot be enumerated. It used to be reported as
 * {@code SlotUnavailableException}, which answers 409 Conflict — the right
 * status for a slot that is already taken, but not for a booking that is not
 * there.
 */
public class BookingNotFoundException extends RuntimeException {
    public BookingNotFoundException(String message) {
        super(message);
    }
}
