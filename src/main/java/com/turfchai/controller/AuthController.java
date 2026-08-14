package com.turfchai.controller;

import com.turfchai.dto.request.LoginRequest;
import com.turfchai.dto.request.OtpRequest;
import com.turfchai.dto.request.OtpVerifyRequest;
import com.turfchai.dto.request.RefreshTokenRequest;
import com.turfchai.dto.request.RegisterRequest;
import com.turfchai.dto.response.AuthResponse;
import com.turfchai.dto.response.OtpRequestResponse;
import com.turfchai.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<AuthResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request.refreshToken()));
    }

    @PostMapping("/otp/request")
    public ResponseEntity<OtpRequestResponse> requestOtp(@Valid @RequestBody OtpRequest request) {
        return ResponseEntity.ok(authService.requestOtp(request));
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<AuthResponse> verifyOtp(@Valid @RequestBody OtpVerifyRequest request) {
        return ResponseEntity.ok(authService.verifyOtp(request));
    }

    @GetMapping("/check-email")
    public ResponseEntity<java.util.Map<String, Boolean>> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(java.util.Map.of("exists", authService.checkEmail(email)));
    }
}
