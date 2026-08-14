package com.turfchai.dto;

/**
 * Standardized API response envelope.
 * <p>
 * All REST endpoints return {@code ApiResponse<T>} so clients can reliably
 * detect success/failure without inspecting HTTP status alone.
 * </p>
 *
 * @param <T> the type of the response payload
 */
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final String message;
    private final String error;

    private ApiResponse(boolean success, T data, String message, String error) {
        this.success = success;
        this.data = data;
        this.message = message;
        this.error = error;
    }

    // ── Factory helpers ────────────────────────────────────────────────────

    /** Successful response carrying a data payload. */
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, null);
    }

    /** Successful response with a human-readable message and no payload. */
    public static <T> ApiResponse<T> ok(String message) {
        return new ApiResponse<>(true, null, message, null);
    }

    /** Successful response carrying both a payload and a message. */
    public static <T> ApiResponse<T> ok(T data, String message) {
        return new ApiResponse<>(true, data, message, null);
    }

    /** Error response with a developer-facing error description. */
    public static <T> ApiResponse<T> error(String error) {
        return new ApiResponse<>(false, null, null, error);
    }

    // ── Accessors ──────────────────────────────────────────────────────────

    public boolean isSuccess() {
        return success;
    }

    public T getData() {
        return data;
    }

    public String getMessage() {
        return message;
    }

    public String getError() {
        return error;
    }
}
