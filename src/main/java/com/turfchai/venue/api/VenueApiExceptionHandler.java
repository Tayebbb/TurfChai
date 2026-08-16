package com.turfchai.venue.api;

import com.turfchai.exception.ApiErrorBody;
import com.turfchai.venue.service.VenueSearchService.VenueNotFoundException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import java.util.Map;

/**
 * Scoped to venue endpoints. Bodies use the platform-wide
 * {@link ApiErrorBody} envelope so a client does not have to parse one shape
 * for venue errors and another for everything else.
 */
@RestControllerAdvice(basePackages = "com.turfchai.venue.api")
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class VenueApiExceptionHandler {

    @ExceptionHandler(VenueNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(VenueNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiErrorBody.of(HttpStatus.NOT_FOUND, e.getMessage()));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, Object>> handleSecurity(SecurityException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiErrorBody.of(HttpStatus.FORBIDDEN, e.getMessage()));
    }

    @ExceptionHandler({IllegalArgumentException.class, HandlerMethodValidationException.class,
            ConstraintViolationException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception e) {
        String message = e instanceof IllegalArgumentException
                ? e.getMessage()
                : "Invalid request parameters";
        return ResponseEntity.badRequest().body(ApiErrorBody.of(HttpStatus.BAD_REQUEST, message));
    }
}
