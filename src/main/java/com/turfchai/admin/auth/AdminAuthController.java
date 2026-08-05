package com.turfchai.admin.auth;

import com.turfchai.admin.auth.dto.request.AdminLoginRequest;
import com.turfchai.admin.auth.dto.request.AdminLoginVerifyRequest;
import com.turfchai.admin.auth.dto.response.AdminLoginChallengeResponse;
import com.turfchai.dto.response.AuthResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-scoped 2FA login endpoints. Deliberately separate from the shared
 * {@code /api/v1/auth/*} flow — the admin console never receives a token
 * until the one-time code has been verified.
 */
@RestController
@RequestMapping("/api/v1/admin/auth")
@RequiredArgsConstructor
public class AdminAuthController {

    private final AdminAuthService adminAuthService;

    /** Step 1 — validate credentials, send the code, return a challenge. */
    @PostMapping("/login")
    public ResponseEntity<AdminLoginChallengeResponse> login(@Valid @RequestBody AdminLoginRequest request) {
        return ResponseEntity.ok(adminAuthService.challenge(request));
    }

    /** Step 2 — exchange challenge + code for a JWT session. */
    @PostMapping("/login/verify")
    public ResponseEntity<AuthResponse> verify(@Valid @RequestBody AdminLoginVerifyRequest request) {
        return ResponseEntity.ok(adminAuthService.verify(request));
    }
}