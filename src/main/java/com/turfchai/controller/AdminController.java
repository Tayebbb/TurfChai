package com.turfchai.controller;

import com.turfchai.dto.request.AppointAdminRequest;
import com.turfchai.dto.request.UpdateAdminPermissionsRequest;
import com.turfchai.dto.response.AdminResponse;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/admins")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public List<AdminResponse> listAdmins(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return adminService.listAdmins(principal.getId());
    }

    @PostMapping("/admins")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminResponse appoint(@Valid @RequestBody AppointAdminRequest request, Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return adminService.appoint(request, principal.getId());
    }

    @PatchMapping("/admins/{adminId}/permissions")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AdminResponse updatePermissions(
            @PathVariable Long adminId,
            @Valid @RequestBody UpdateAdminPermissionsRequest request) {
        return adminService.updatePermissions(adminId, request.permissions());
    }

    @PostMapping("/admins/{adminId}/deactivate")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public AdminResponse deactivate(@PathVariable Long adminId, Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return adminService.deactivate(adminId, principal.getId());
    }
}