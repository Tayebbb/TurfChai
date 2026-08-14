package com.turfchai.controller;

import com.turfchai.dto.request.CheckInRequest;
import com.turfchai.dto.response.CheckInResponse;
import com.turfchai.dto.response.TicketResponse;
import com.turfchai.security.UserPrincipal;
import com.turfchai.service.TicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Gate passes for open games.
 *
 * <p>The holder is always taken from the authenticated principal, never from
 * the request — a ticket for someone else is not something a client can ask
 * for.
 */
@RestController
@RequestMapping("/api/v1/solo/tickets")
@RequiredArgsConstructor
public class TicketRestController {

    private final TicketService ticketService;

    @GetMapping("/{gameId}")
    @PreAuthorize("hasAnyRole('PLAYER','SOLO_PLAYER','HOST','OWNER','ADMIN')")
    public ResponseEntity<TicketResponse> getTicket(@AuthenticationPrincipal UserPrincipal principal,
                                                    @PathVariable Long gameId) {
        return ResponseEntity.ok(ticketService.getTicket(gameId, principal.getId()));
    }

    /** Gate scanner: verifies the signed payload and marks attendance. */
    @PostMapping("/check-in")
    @PreAuthorize("hasAnyRole('HOST','OWNER','ADMIN')")
    public ResponseEntity<CheckInResponse> checkIn(@Valid @RequestBody CheckInRequest request) {
        return ResponseEntity.ok(ticketService.checkIn(request.getToken()));
    }
}
