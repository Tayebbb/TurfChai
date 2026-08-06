package com.turfchai.controller;

import com.turfchai.model.TurfRequest;
import com.turfchai.service.TurfApprovalService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/turf-requests")
@RequiredArgsConstructor
public class AdminTurfRequestRestController {

    private final TurfApprovalService turfApprovalService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public List<TurfRequest> listRequests(@RequestParam(required = false) String status) {
        return turfApprovalService.listByStatus(status);
    }

    @GetMapping("/{code}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public TurfRequest getRequest(@PathVariable String code) {
        return turfApprovalService.getByCode(code);
    }

    @PostMapping("/{code}/review")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public void reviewRequest(@PathVariable String code, 
                              @RequestBody Map<String, String> payload, 
                              @AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        String action = payload.get("action");
        String note = payload.get("note");
        turfApprovalService.review(code, action, note, userDetails.getId());
    }
}
