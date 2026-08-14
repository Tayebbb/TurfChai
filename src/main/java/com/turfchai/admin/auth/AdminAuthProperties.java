package com.turfchai.admin.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Admin 2FA configuration (prefix {@code app.otp}).
 *
 * @param exposeDevCode when true, the generated login code is returned in the
 *                      API response as {@code devCode}. Dev/demo convenience —
 *                      disable in production.
 */
@ConfigurationProperties(prefix = "app.otp")
public record AdminAuthProperties(boolean exposeDevCode) {
}