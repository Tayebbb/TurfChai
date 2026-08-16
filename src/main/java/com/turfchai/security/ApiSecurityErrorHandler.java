package com.turfchai.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.turfchai.exception.ApiErrorBody;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Renders filter-chain rejections in the same envelope every other error uses.
 *
 * <p>
 * Previously these came back as a bare status with no body, which meant a
 * client parsing {@code message} succeeded for a 409 and threw for a 401.
 *
 * <p>
 * Note on unrouted paths: an anonymous request to a path that matches no
 * handler is answered 401, not 404, because
 * {@code anyRequest().authenticated()}
 * runs before dispatch. That is deliberate — deny-by-default must not depend on
 * a route existing, and answering 404 here would let an anonymous caller
 * enumerate which endpoints are real. Authenticated callers do get a 404.
 */
@Component
@RequiredArgsConstructor
public class ApiSecurityErrorHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        write(response, HttpStatus.UNAUTHORIZED, "Authentication is required to access this resource");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        write(response, HttpStatus.FORBIDDEN, "You do not have permission to perform this action");
    }

    private void write(HttpServletResponse response, HttpStatus status, String message) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(), ApiErrorBody.of(status, message));
    }
}
