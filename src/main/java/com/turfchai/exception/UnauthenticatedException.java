package com.turfchai.exception;

/**
 * The request reached a handler that needs an identity, but no authenticated
 * principal was present. Mapped to 401 by {@link GlobalExceptionHandler}.
 *
 * <p>
 * This exists as defence in depth: the filter chain is the primary control,
 * but a handler must never fall back to a demo/default user if a route is ever
 * mistakenly opened up again.
 */
public class UnauthenticatedException extends RuntimeException {

    public UnauthenticatedException(String message) {
        super(message);
    }
}
