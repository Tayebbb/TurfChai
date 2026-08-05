package com.turfchai.exception;

public class GameFullException extends RuntimeException {
    public GameFullException(String message) {
        super(message);
    }
}
