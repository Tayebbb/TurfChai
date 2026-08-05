package com.turfchai.exception;

public class LowReliabilityScoreException extends RuntimeException {
    public LowReliabilityScoreException(String message) {
        super(message);
    }
}
