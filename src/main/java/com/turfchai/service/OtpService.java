package com.turfchai.service;

public interface OtpService {
    String generateAndStore(String phone);
    boolean isValid(String phone, String code);
}
