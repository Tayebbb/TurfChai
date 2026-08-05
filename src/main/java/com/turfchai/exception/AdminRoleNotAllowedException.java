package com.turfchai.exception;

/**
 * Thrown when a public registration request tries to claim a privileged role
 * (ADMIN / SUPER_ADMIN). Admin accounts can only be created by a super admin.
 */
public class AdminRoleNotAllowedException extends RuntimeException {
    public AdminRoleNotAllowedException(String message) {
        super(message);
    }
}