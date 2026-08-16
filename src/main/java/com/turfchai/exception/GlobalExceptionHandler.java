package com.turfchai.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

        private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

        private Map<String, Object> buildErrorResponse(HttpStatus status, String message) {
                Map<String, Object> response = new HashMap<>();
                response.put("timestamp", OffsetDateTime.now());
                response.put("status", status.value());
                response.put("error", status.getReasonPhrase());
                response.put("message", message);
                return response;
        }

        @ExceptionHandler(OpenGameNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleOpenGameNotFound(OpenGameNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        @ExceptionHandler(BookingNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleBookingNotFound(BookingNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        @ExceptionHandler(UserNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleUserNotFound(UserNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        @ExceptionHandler(VenueNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleVenueNotFound(VenueNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        @ExceptionHandler(TurfRequestNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleTurfRequestNotFound(TurfRequestNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        @ExceptionHandler(ReviewNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleReviewNotFound(ReviewNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        /**
         * The request is well-formed but the target is in a state that forbids it —
         * approving an already-approved listing, for instance. That is a conflict,
         * not a server fault; it used to reach the catch-all and report a 500.
         */
        @ExceptionHandler(IllegalStateException.class)
        public ResponseEntity<Map<String, Object>> handleIllegalState(IllegalStateException ex) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT, ex.getMessage()));
        }

        @ExceptionHandler(GameFullException.class)
        public ResponseEntity<Map<String, Object>> handleGameFull(GameFullException ex) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT, ex.getMessage()));
        }

        /** Same status the public validate-code endpoint uses for a refused code. */
        @ExceptionHandler(PromotionRejectedException.class)
        public ResponseEntity<Map<String, Object>> handlePromotionRejected(PromotionRejectedException ex) {
                return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                                .body(buildErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage()));
        }

        @ExceptionHandler(AlreadyJoinedException.class)
        public ResponseEntity<Map<String, Object>> handleAlreadyJoined(AlreadyJoinedException ex) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT, ex.getMessage()));
        }

        @ExceptionHandler(InvalidSkillLevelException.class)
        public ResponseEntity<Map<String, Object>> handleInvalidSkillLevel(InvalidSkillLevelException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        @ExceptionHandler(InvalidGameStateException.class)
        public ResponseEntity<Map<String, Object>> handleInvalidGameState(InvalidGameStateException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        @ExceptionHandler(LowReliabilityScoreException.class)
        public ResponseEntity<Map<String, Object>> handleLowReliability(LowReliabilityScoreException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        @ExceptionHandler(InvalidTicketException.class)
        public ResponseEntity<Map<String, Object>> handleInvalidTicket(InvalidTicketException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        @ExceptionHandler(LfgAlertNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleLfgAlertNotFound(LfgAlertNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        @ExceptionHandler(EmailAlreadyExistsException.class)
        public ResponseEntity<Map<String, Object>> handleEmailAlreadyExists(EmailAlreadyExistsException ex) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT, ex.getMessage()));
        }

        @ExceptionHandler(PhoneAlreadyExistsException.class)
        public ResponseEntity<Map<String, Object>> handlePhoneAlreadyExists(PhoneAlreadyExistsException ex) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT, ex.getMessage()));
        }

        @ExceptionHandler(InvalidCredentialsException.class)
        public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException ex) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body(buildErrorResponse(HttpStatus.UNAUTHORIZED, ex.getMessage()));
        }

        /**
         * A handler needed an identity and there was none. The filter chain is the
         * primary control; this is the fail-closed backstop behind it.
         */
        @ExceptionHandler(UnauthenticatedException.class)
        public ResponseEntity<Map<String, Object>> handleUnauthenticated(UnauthenticatedException ex) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                .body(buildErrorResponse(HttpStatus.UNAUTHORIZED, ex.getMessage()));
        }

        @ExceptionHandler(AdminNotFoundException.class)
        public ResponseEntity<Map<String, Object>> handleAdminNotFound(AdminNotFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, ex.getMessage()));
        }

        @ExceptionHandler(AdminActionException.class)
        public ResponseEntity<Map<String, Object>> handleAdminAction(AdminActionException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        @ExceptionHandler(AdminRoleNotAllowedException.class)
        public ResponseEntity<Map<String, Object>> handleAdminRoleNotAllowed(AdminRoleNotAllowedException ex) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(buildErrorResponse(HttpStatus.FORBIDDEN, ex.getMessage()));
        }

        @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
        public ResponseEntity<Map<String, Object>> handleAccessDenied(
                        org.springframework.security.access.AccessDeniedException ex) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(buildErrorResponse(HttpStatus.FORBIDDEN,
                                                "You do not have permission to perform this action"));
        }

        @ExceptionHandler(SecurityException.class)
        public ResponseEntity<Map<String, Object>> handleSecurity(SecurityException ex) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(buildErrorResponse(HttpStatus.FORBIDDEN, ex.getMessage()));
        }

        @ExceptionHandler(IllegalArgumentException.class)
        public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        @ExceptionHandler(OtpException.class)
        public ResponseEntity<Map<String, Object>> handleOtp(OtpException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        @ExceptionHandler(com.turfchai.booking.exception.SlotUnavailableException.class)
        public ResponseEntity<Map<String, Object>> handleSlotUnavailable(
                        com.turfchai.booking.exception.SlotUnavailableException ex) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT, ex.getMessage()));
        }

        @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
        public ResponseEntity<Map<String, Object>> handleDataIntegrity(
                        org.springframework.dao.DataIntegrityViolationException ex) {
                log.warn("Data integrity violation", ex);
                // The one-active-booking-per-slot index is the last line of defence against
                // double-selling. When it fires the caller lost a race, and telling them
                // "database constraint error" is both meaningless and alarming.
                String detail = ex.getMostSpecificCause().getMessage();
                if (detail != null && detail.toLowerCase(java.util.Locale.ROOT).contains("uq_bookings_active_slot")) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                        .body(buildErrorResponse(HttpStatus.CONFLICT,
                                                        "Someone just took this slot. Please pick another time."));
                }
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT,
                                                "Database constraint error: duplicate or invalid data"));
        }

        /**
         * Two people acted on the same booking at once. Neither request was wrong, so
         * the loser is asked to retry rather than shown a failure.
         */
        @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
        public ResponseEntity<Map<String, Object>> handleOptimisticLock(
                        org.springframework.orm.ObjectOptimisticLockingFailureException ex) {
                log.warn("Optimistic locking failure", ex);
                return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(buildErrorResponse(HttpStatus.CONFLICT,
                                                "This booking was updated at the same time somewhere else. Please refresh and try again."));
        }

        /**
         * The pricing model is a dependency, not a contract: when it is down the
         * caller should be told to retry later rather than that their request was
         * malformed.
         */
        @ExceptionHandler(PricingUnavailableException.class)
        public ResponseEntity<Map<String, Object>> handlePricingUnavailable(PricingUnavailableException ex) {
                log.error("Pricing model unavailable", ex);
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                                .body(buildErrorResponse(HttpStatus.SERVICE_UNAVAILABLE,
                                                "Dynamic pricing is temporarily unavailable. Please try again shortly."));
        }

        @ExceptionHandler(MethodArgumentNotValidException.class)
        public ResponseEntity<Map<String, Object>> handleValidationExceptions(MethodArgumentNotValidException ex) {
                Map<String, String> errors = new HashMap<>();
                for (FieldError error : ex.getBindingResult().getFieldErrors()) {
                        errors.put(error.getField(), error.getDefaultMessage());
                }
                Map<String, Object> response = buildErrorResponse(HttpStatus.BAD_REQUEST, "Validation failed");
                response.put("validationErrors", errors);
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
        }

        /**
         * Unparseable or wrongly-typed JSON is the caller's mistake. Only the
         * package-scoped advices handled this, so every other endpoint answered a
         * syntax error with a 500.
         */
        @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
        public ResponseEntity<Map<String, Object>> handleUnreadableBody(
                        org.springframework.http.converter.HttpMessageNotReadableException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST,
                                                "Request body is missing or malformed"));
        }

        /**
         * A path/query value that cannot be coerced to the declared type is a client
         * error, not a 500.
         */
        @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
        public ResponseEntity<Map<String, Object>> handleTypeMismatch(
                        org.springframework.web.method.annotation.MethodArgumentTypeMismatchException ex) {
                String message = "Invalid value for '" + ex.getName() + "': " + ex.getValue();
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, message));
        }

        /**
         * Omitting a required query param, header, path variable or cookie is the
         * caller's mistake. Without this the catch-all below turns it into a 500,
         * which tells the client to retry something that can never succeed.
         */
        @ExceptionHandler(org.springframework.web.bind.ServletRequestBindingException.class)
        public ResponseEntity<Map<String, Object>> handleMissingRequestValue(
                        org.springframework.web.bind.ServletRequestBindingException ex) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                .body(buildErrorResponse(HttpStatus.BAD_REQUEST, ex.getMessage()));
        }

        /**
         * An unrouted path. Without this the catch-all reports a 500 and echoes
         * Spring's internal "No static resource ..." text, which both misleads the
         * caller and describes how the application resolves requests.
         */
        @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
        public ResponseEntity<Map<String, Object>> handleNoResource(
                        org.springframework.web.servlet.resource.NoResourceFoundException ex) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                .body(buildErrorResponse(HttpStatus.NOT_FOUND, "No endpoint matches this request"));
        }

        @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
        public ResponseEntity<Map<String, Object>> handleMethodNotSupported(
                        org.springframework.web.HttpRequestMethodNotSupportedException ex) {
                return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                                .body(buildErrorResponse(HttpStatus.METHOD_NOT_ALLOWED, ex.getMessage()));
        }

        @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
        public ResponseEntity<Map<String, Object>> handleMediaTypeNotSupported(
                        org.springframework.web.HttpMediaTypeNotSupportedException ex) {
                return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                                .body(buildErrorResponse(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ex.getMessage()));
        }

        /**
         * The client went away mid-response — almost always a browser closing an
         * SSE stream. Nothing can be written to a response that no longer has a
         * peer, and letting this reach the catch-all below makes it try to render
         * JSON into a {@code text/event-stream} response, logging a
         * {@code HttpMessageNotWritableException} stack trace for every closed tab.
         * An empty body and no content type is the whole correct response here.
         */
        @ExceptionHandler(org.springframework.web.context.request.async.AsyncRequestNotUsableException.class)
        public void handleAsyncRequestNotUsable(
                        org.springframework.web.context.request.async.AsyncRequestNotUsableException ex) {
                // Intentionally empty: void signals "handled, write nothing".
        }

        /**
         * Anything unmapped is a bug, so the detail goes to the log where it is
         * useful and not to the caller, who would otherwise be told things like
         * which resolver failed or what a constraint is named.
         */
        @ExceptionHandler(Exception.class)
        public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex) {
                log.error("Unhandled exception", ex);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body(buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR,
                                                "Something went wrong on our side. Please try again."));
        }
}
