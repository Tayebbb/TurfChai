package com.turfchai.service;

import com.turfchai.dto.request.LoginRequest;
import com.turfchai.dto.request.OtpRequest;
import com.turfchai.dto.request.OtpVerifyRequest;
import com.turfchai.dto.request.RegisterRequest;
import com.turfchai.dto.request.UpdateProfileRequest;
import com.turfchai.dto.response.AuthResponse;
import com.turfchai.dto.response.OtpRequestResponse;
import com.turfchai.dto.response.UserResponse;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    OtpRequestResponse requestOtp(OtpRequest request);
    AuthResponse verifyOtp(OtpVerifyRequest request);
    AuthResponse refreshToken(String refreshToken);
    UserResponse getCurrentUser(String publicId);
    UserResponse updateProfile(String publicId, UpdateProfileRequest request);
}
