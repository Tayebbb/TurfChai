package com.turfchai.service;

import com.turfchai.model.TurfRequest;
import com.turfchai.repository.TurfRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TurfApprovalService {

    private final TurfRequestRepository turfRequestRepository;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public List<TurfRequest> listByStatus(String status) {
        if (status == null || status.isBlank()) {
            return turfRequestRepository.findAllByOrderByCreatedAtDesc();
        }
        return turfRequestRepository.findByStatusOrderByCreatedAtAsc(status.toUpperCase());
    }

    @Transactional(readOnly = true)
    public TurfRequest getByCode(String requestCode) {
        return turfRequestRepository.findByRequestCode(requestCode)
                .orElseThrow(() -> new IllegalArgumentException("TurfRequest not found: " + requestCode));
    }

    @Transactional
    public void review(String requestCode, String action, String adminNote, Long adminUserId) {
        TurfRequest request = getByCode(requestCode);
        String currentStatus = request.getStatus();

        // ponytail: no state-machine library. switch has a known ceiling, upgrade to Spring StateMachine if >10 states
        switch (action.toUpperCase()) {
            case "APPROVE":
                if (!currentStatus.equals("PENDING") && !currentStatus.equals("CHANGES_REQUESTED")) {
                    throw new IllegalStateException("Cannot approve request in status: " + currentStatus);
                }
                request.setStatus("APPROVED");
                // Note: Normally we'd create the Venue record here and set request.venueId.
                // Assuming venue creation happens independently or in a later step.
                break;
            case "REJECT":
                if (!currentStatus.equals("PENDING") && !currentStatus.equals("CHANGES_REQUESTED")) {
                    throw new IllegalStateException("Cannot reject request in status: " + currentStatus);
                }
                request.setStatus("REJECTED");
                break;
            case "REQUEST_CHANGES":
                if (!currentStatus.equals("PENDING")) {
                    throw new IllegalStateException("Cannot request changes for request in status: " + currentStatus);
                }
                request.setStatus("CHANGES_REQUESTED");
                break;
            default:
                throw new IllegalArgumentException("Unknown action: " + action);
        }

        request.setAdminNote(adminNote);
        request.setReviewedBy(adminUserId);
        request.setReviewedAt(OffsetDateTime.now());
        turfRequestRepository.save(request);

        // Send notification to owner
        String title = "Turf Listing " + action;
        String body = "Your turf listing request for " + request.getVenueName() + " has been " + request.getStatus();
        if (adminNote != null && !adminNote.isBlank()) {
            body += ". Note: " + adminNote;
        }
        notificationService.send(request.getOwnerUserId(), "TURF_REQUEST", title, body, "/owner/venue-setup");
    }
}
