package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.model.AuditLog;
import com.turfchai.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/audit-log")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*")
public class AdminAuditLogRestController {

    private final AuditLogService auditLogService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Page<AuditLog>>> getAuditLogs(
            @RequestParam(required = false) String filter,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AuditLog> logs = auditLogService.getAuditLogs(filter, page, size);
        return ResponseEntity.ok(ApiResponse.ok(logs));
    }
}
