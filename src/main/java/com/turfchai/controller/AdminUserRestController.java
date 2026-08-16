package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.dto.response.AdminUserResponse;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "*")
public class AdminUserRestController {

    /** A caller asking for everything still gets a bounded response. */
    private static final int MAX_PAGE_SIZE = 100;

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        RoleType roleFilter = null;
        if (role != null && !role.isBlank() && !"all".equalsIgnoreCase(role)) {
            try {
                roleFilter = RoleType.valueOf(role.toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // An unknown role matches nobody rather than everybody.
                return ResponseEntity.ok(ApiResponse.ok(pageBody(Page.empty(), 0, size)));
            }
        }

        boolean suspendedOnly = "suspended".equalsIgnoreCase(status);
        String statusFilter = (status == null || status.isBlank() || suspendedOnly || "all".equalsIgnoreCase(status))
                ? null
                : status;
        String term = (q == null || q.isBlank()) ? null : "%" + q.toLowerCase() + "%";

        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        Page<User> found = userRepository.searchForAdmin(
                roleFilter, suspendedOnly, statusFilter, term,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));

        return ResponseEntity.ok(ApiResponse.ok(pageBody(found, safePage, safeSize)));
    }

    private Map<String, Object> pageBody(Page<User> found, int page, int size) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", found.getContent().stream().map(AdminUserResponse::from).toList());
        body.put("total", found.getTotalElements());
        body.put("page", page);
        body.put("size", size);
        body.put("totalPages", found.getTotalPages());
        return body;
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> payload,
            Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id " + id));

        if (payload.containsKey("status")) {
            user.setStatus(String.valueOf(payload.get("status")).toUpperCase());
        }
        if (payload.containsKey("isSuspended")) {
            user.setIsSuspended(Boolean.parseBoolean(String.valueOf(payload.get("isSuspended"))));
        }

        User saved = userRepository.save(user);

        boolean suspended = Boolean.TRUE.equals(saved.getIsSuspended()) || "SUSPENDED".equalsIgnoreCase(saved.getStatus());
        auditLogService.logAction(
                principal.getUsername(),
                principal.getId(),
                suspended ? "Suspended User" : "Updated User Status",
                suspended ? "red" : "green",
                "#" + id,
                "User " + user.getFullName() + " status set to " + user.getStatus() + " (suspended=" + user.getIsSuspended() + ")"
        );

        return ResponseEntity.ok(ApiResponse.ok(AdminUserResponse.from(saved)));
    }

    @PostMapping("/{id}/reinstate")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<ApiResponse<AdminUserResponse>> reinstate(
            @PathVariable Long id,
            Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();

        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found with id " + id));

        user.setIsSuspended(false);
        user.setStatus("ACTIVE");
        User saved = userRepository.save(user);

        auditLogService.logAction(
                principal.getUsername(),
                principal.getId(),
                "Reinstated User",
                "green",
                "#" + id,
                "User " + user.getFullName() + " reinstated to ACTIVE status"
        );

        return ResponseEntity.ok(ApiResponse.ok(AdminUserResponse.from(saved)));
    }
}
