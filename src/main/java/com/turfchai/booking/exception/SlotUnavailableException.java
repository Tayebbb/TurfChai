package com.turfchai.booking.exception;

/** Thrown when a slot cannot be held, confirmed, or otherwise booked. */
public class SlotUnavailableException extends RuntimeException {

    public SlotUnavailableException(String message) {
        super(message);
    }
}
