package com.turfchai.tournament.api;

import com.turfchai.tournament.service.TournamentService.PitchConflictException;
import com.turfchai.tournament.service.TournamentService.TournamentConflictException;
import com.turfchai.tournament.service.TournamentService.TournamentNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Scoped to tournament endpoints — the platform-wide advice is another dev's task. */
@RestControllerAdvice(basePackages = "com.turfchai.tournament.api")
public class TournamentApiExceptionHandler {

    @ExceptionHandler(TournamentNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleNotFound(TournamentNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler({PitchConflictException.class, TournamentConflictException.class})
    public ResponseEntity<Map<String, String>> handleConflict(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .findFirst()
                .orElse("invalid request");
        return ResponseEntity.badRequest().body(Map.of("error", detail));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}
