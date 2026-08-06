package com.turfchai.exception;

import com.turfchai.dto.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;

/** Maps every API failure to the same {@link ApiResponse} envelope. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private ResponseEntity<ApiResponse<Map<String, Object>>> error(HttpStatus status, String message) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", status.value());
        return ResponseEntity.status(status).body(ApiResponse.error(message));
    }

    @ExceptionHandler({OpenGameNotFoundException.class, UserNotFoundException.class,
            VenueNotFoundException.class, AdminNotFoundException.class})
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleNotFound(RuntimeException ex) {
        return error(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler({GameFullException.class, AlreadyJoinedException.class,
            ReviewAlreadyExistsException.class, DataIntegrityViolationException.class})
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleConflict(RuntimeException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler({InvalidSkillLevelException.class, InvalidGameStateException.class,
            LowReliabilityScoreException.class, OtpException.class, AdminActionException.class,
            ReviewEligibilityException.class, IllegalArgumentException.class,
            ConstraintViolationException.class})
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleBadRequest(RuntimeException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler({EmailAlreadyExistsException.class, PhoneAlreadyExistsException.class})
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleDuplicateIdentity(RuntimeException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleInvalidCredentials(InvalidCredentialsException ex) {
        return error(HttpStatus.UNAUTHORIZED, ex.getMessage());
    }

    @ExceptionHandler({AdminRoleNotAllowedException.class,
            org.springframework.security.access.AccessDeniedException.class})
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleForbidden(RuntimeException ex) {
        return error(HttpStatus.FORBIDDEN, "You do not have permission to perform this action");
    }

    @ExceptionHandler(com.turfchai.booking.exception.SlotUnavailableException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleSlotUnavailable(
            com.turfchai.booking.exception.SlotUnavailableException ex) {
        return error(HttpStatus.CONFLICT, ex.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> validationErrors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            validationErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        // ApiResponse has a stable top-level error field; callers can use the
        // message for display and validation errors are logged by the client.
        return error(HttpStatus.BAD_REQUEST, "Validation failed: " + validationErrors);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return error(HttpStatus.BAD_REQUEST, "Invalid value for '" + ex.getName() + "': " + ex.getValue());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleUnexpected(Exception ex) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
    }
}
