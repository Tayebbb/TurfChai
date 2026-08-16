package com.turfchai.exception;

import org.springframework.http.HttpStatus;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The one shape every error in this API takes.
 *
 * <p>It lives outside {@link GlobalExceptionHandler} because the security
 * filter chain rejects requests before any controller advice runs, and those
 * rejections used to come back with an empty body — so clients had to special
 * case 401 and 403 against every other failure.
 */
public final class ApiErrorBody {

    private ApiErrorBody() {
    }

    public static Map<String, Object> of(HttpStatus status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        // Formatted here rather than left as an OffsetDateTime: this body is
        // also written by the security filter chain through the plain
        // ObjectMapper bean, which has no JSR-310 module registered.
        body.put("timestamp", OffsetDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        return body;
    }
}
