package com.turfchai.admin.auth;

import com.turfchai.admin.auth.dto.request.AdminLoginRequest;
import com.turfchai.admin.auth.dto.request.AdminLoginVerifyRequest;
import com.turfchai.admin.auth.dto.response.AdminLoginChallengeResponse;
import com.turfchai.dto.response.AuthResponse;

/**
 * Two-factor login flow for the admin console:
 * 1. {@link #challenge(AdminLoginRequest)} — validates credentials, mails a
 *    one-time code, returns a challenge handle (no token yet).
 * 2. {@link #verify(AdminLoginVerifyRequest)} — checks the submitted code and,
 *    when correct, issues the JWT session.
 */
public interface AdminAuthService {

    AdminLoginChallengeResponse challenge(AdminLoginRequest request);

    AuthResponse verify(AdminLoginVerifyRequest request);
}