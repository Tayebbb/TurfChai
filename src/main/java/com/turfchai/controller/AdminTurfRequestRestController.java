package com.turfchai.controller;

import com.turfchai.dto.response.TurfRequestResponse;
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
    public List<TurfRequestResponse> listRequests(@RequestParam(required = false) String status) {
        return turfApprovalService.listByStatus(status).stream().map(TurfRequestResponse::from).toList();
    }

    @GetMapping("/{code}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public TurfRequestResponse getRequest(@PathVariable String code) {
        return TurfRequestResponse.from(turfApprovalService.getByCode(code));
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
