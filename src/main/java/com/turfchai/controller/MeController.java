package com.turfchai.controller;

import com.turfchai.dto.response.UserResponse;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class MeController {

    private final AuthService authService;

    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN','SUPER_ADMIN')")
    public UserResponse me(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return authService.getCurrentUser(principal.getPublicId());
    }
}
