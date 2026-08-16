package com.turfchai.controller;

import com.turfchai.dto.response.NotificationResponse;
import com.turfchai.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationRestController {

    private final NotificationService notificationService;

    @GetMapping
    public List<NotificationResponse> listNotifications(
            @AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        return notificationService.listForUser(userDetails.getId())
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount(@AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        return Map.of("count", notificationService.getUnreadCount(userDetails.getId()));
    }

    @PostMapping("/{id}/read")
    public void markRead(@PathVariable Long id,
            @AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        notificationService.markRead(id, userDetails.getId());
    }

    @PostMapping("/read-all")
    public void markAllRead(@AuthenticationPrincipal com.turfchai.security.UserPrincipal userDetails) {
        notificationService.markAllRead(userDetails.getId());
    }
}
