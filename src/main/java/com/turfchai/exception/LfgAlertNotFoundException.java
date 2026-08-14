package com.turfchai.exception;

/** No LFG alert exists with the requested id. */
public class LfgAlertNotFoundException extends RuntimeException {

    public LfgAlertNotFoundException(String message) {
        super(message);
    }
}
