package com.turfchai.exception;

/** A ticket QR code that is forged, malformed, expired, or not yet valid. */
public class InvalidTicketException extends RuntimeException {

    public InvalidTicketException(String message) {
        super(message);
    }
}
