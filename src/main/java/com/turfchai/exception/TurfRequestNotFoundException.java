package com.turfchai.exception;

/** A listing request was addressed by a code that does not exist. */
public class TurfRequestNotFoundException extends RuntimeException {

    public TurfRequestNotFoundException(String message) {
        super(message);
    }
}
