package com.turfchai.controller;

import com.turfchai.security.UserPrincipal;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/owner/analytics")
@PreAuthorize("hasAnyRole('OWNER','ADMIN','SUPER_ADMIN')")
@SecurityRequirement(name = "bearerAuth")
public class OwnerAnalyticsRestController {

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Object>> getDashboardData(
            @AuthenticationPrincipal UserPrincipal principal) {
        
        // Mock data structure matching the frontend UI requirements for the Owner Dashboard
        List<Map<String, Object>> kpis = List.of(
                Map.of("label", "Today's revenue", "value", "৳18,400", "delta", "▲ 12% vs last Fri", "trend", "up"),
                Map.of("label", "Bookings today", "value", "14", "delta", "▲ 2 more than avg", "trend", "up"),
                Map.of("label", "Occupancy", "value", "72%", "delta", "Peak 4–11 PM: 94%", "trend", ""),
                Map.of("label", "Pending payments", "value", "৳4,300", "delta", "3 bookings awaiting", "trend", "down")
        );

        List<Map<String, Object>> nextUp = List.of(
                Map.of("id", "p2-730", "slot", "7:30 PM · Pitch 2", 
                       "badge", Map.of("tone", "green", "text", "Online · paid"),
                       "detail", "Rafiul Karim · 10 players · TC-48291 · handover 7:20",
                       "action", Map.of("kind", "link", "to", "/owner/bookings", "label", "Detail", "variant", "secondary")),
                Map.of("id", "p1-730", "slot", "7:30 PM · Pitch 1", 
                       "badge", Map.of("tone", "amber", "text", "Phone · deposit"),
                       "detail", "Karim Traders XI · ৳765 paid · ৳1,785 due",
                       "action", Map.of("kind", "toast", "toast", "Marked as arrived ✓", "label", "Arrived", "variant", "secondary"))
        );

        List<Map<String, Object>> activity = List.of(
                Map.of("id", "bkash", "title", "bKash payment reconciled — ৳2,550", "detail", "TC-48291 · Rafiul K. · auto-matched to evening shift · 6:12 PM"),
                Map.of("id", "open-game", "title", "Open game filled 10/10", "detail", "Friday Night Football · last share ৳280 paid · 5:47 PM")
        );

        List<Map<String, Object>> attention = List.of(
                Map.of("id", "deposits", "tone", "warn", "icon", "💰", "title", "3 deposit bookings due tonight", 
                       "body", "৳4,300 to collect at venue. ", "link", Map.of("to", "/owner/bookings", "label", "View list")),
                Map.of("id", "reviews", "tone", "info", "icon", "⭐", "title", "2 new reviews await response", 
                       "body", "Replying raises repeat bookings. ", "link", Map.of("to", "/owner/reviews", "label", "Respond"))
        );

        return ResponseEntity.ok(Map.of(
                "kpis", kpis,
                "nextUp", nextUp,
                "activity", activity,
                "attention", attention
        ));
    }
}
