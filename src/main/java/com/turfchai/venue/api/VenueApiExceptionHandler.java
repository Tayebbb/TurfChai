package com.turfchai.venue.api;

import com.turfchai.venue.service.VenueSearchService.VenueNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Scoped to venue endpoints only — the platform-wide @ControllerAdvice is a
 * separate infrastructure task owned by another developer.
 */
@RestControllerAdvice(basePackages = "com.turfchai.venue.api")
public class VenueApiExceptionHandler {

    @ExceptionHandler(VenueNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(VenueNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}
