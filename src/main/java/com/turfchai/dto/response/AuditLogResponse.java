package com.turfchai.dto.response;

import com.turfchai.model.AuditLog;

import java.time.OffsetDateTime;

/** One admin audit-trail entry. */
public record AuditLogResponse(
        Long id,
        String adminName,
        Long adminId,
        String action,
        String actionTone,
        String target,
        String details,
        OffsetDateTime createdAt) {

    public static AuditLogResponse from(AuditLog log) {
        if (log == null) {
            return null;
        }
        return new AuditLogResponse(
                log.getId(),
                log.getAdminName(),
                log.getAdminId(),
                log.getAction(),
                log.getActionTone(),
                log.getTarget(),
                log.getDetails(),
                log.getCreatedAt());
    }
}
