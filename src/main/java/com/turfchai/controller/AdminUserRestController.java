package com.turfchai.controller;

import com.turfchai.dto.ApiResponse;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminUserRestController {

    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<User>>> listUsers(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q) {

        List<User> users = userRepository.findAll().stream()
                .filter(u -> {
                    if (role != null && !role.isBlank() && !"all".equalsIgnoreCase(role)) {
                        if (u.getRole() == null || !u.getRole().name().equalsIgnoreCase(role)) {
                            return false;
                        }
                    }
                    if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
                        if ("suspended".equalsIgnoreCase(status)) {
                            if (!Boolean.TRUE.equals(u.getIsSuspended()) && !"SUSPENDED".equalsIgnoreCase(u.getStatus())) {
                                return false;
                            }
                        } else if (u.getStatus() == null || !u.getStatus().equalsIgnoreCase(status)) {
                            return false;
                        }
                    }
                    if (q != null && !q.isBlank()) {
                        String term = q.toLowerCase();
                        boolean nameMatch = u.getFullName() != null && u.getFullName().toLowerCase().contains(term);
                        boolean emailMatch = u.getEmail() != null && u.getEmail().toLowerCase().contains(term);
                        boolean phoneMatch = u.getPhone() != null && u.getPhone().toLowerCase().contains(term);
                        return nameMatch || emailMatch || phoneMatch;
                    }
                    return true;
                })
                .toList();

        return ResponseEntity.ok(ApiResponse.ok(users));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<ApiResponse<User>> updateStatus(
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

        return ResponseEntity.ok(ApiResponse.ok(saved));
    }

    @PostMapping("/{id}/reinstate")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    @Transactional
    public ResponseEntity<ApiResponse<User>> reinstate(
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

        return ResponseEntity.ok(ApiResponse.ok(saved));
    }
}
