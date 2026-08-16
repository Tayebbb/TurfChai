package com.turfchai.tournament.api;

import com.turfchai.exception.ApiErrorBody;
import com.turfchai.tournament.service.TournamentService.PitchConflictException;
import com.turfchai.tournament.service.TournamentService.TournamentConflictException;
import com.turfchai.tournament.service.TournamentService.TournamentNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/** Scoped to tournament endpoints; bodies use the platform error envelope. */
@RestControllerAdvice(basePackages = "com.turfchai.tournament.api")
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class TournamentApiExceptionHandler {

    @ExceptionHandler(TournamentNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(TournamentNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiErrorBody.of(HttpStatus.NOT_FOUND, e.getMessage()));
    }

    @ExceptionHandler({ PitchConflictException.class, TournamentConflictException.class })
    public ResponseEntity<Map<String, Object>> handleConflict(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ApiErrorBody.of(HttpStatus.CONFLICT, e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String detail = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + " " + error.getDefaultMessage())
                .findFirst()
                .orElse("invalid request");
        return ResponseEntity.badRequest().body(ApiErrorBody.of(HttpStatus.BAD_REQUEST, detail));
    }

    @ExceptionHandler({
            org.springframework.web.method.annotation.HandlerMethodValidationException.class,
            jakarta.validation.ConstraintViolationException.class,
            org.springframework.http.converter.HttpMessageNotReadableException.class
    })
    public ResponseEntity<Map<String, Object>> handleInvalidRequest(Exception e) {
        return ResponseEntity.badRequest().body(ApiErrorBody.of(HttpStatus.BAD_REQUEST, "invalid request"));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(ApiErrorBody.of(HttpStatus.BAD_REQUEST, e.getMessage()));
    }
}
