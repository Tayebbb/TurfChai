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
    private final com.turfchai.repository.UserRepository userRepository;
    private final com.turfchai.venue.service.VenueManagementService venueManagementService;

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
                java.util.List<String> photos = null;
                if (request.getPhotosJson() != null && !request.getPhotosJson().isBlank() && !request.getPhotosJson().equals("[]")) {
                    try {
                        photos = new com.fasterxml.jackson.databind.ObjectMapper().readValue(request.getPhotosJson(), java.util.List.class);
                    } catch (Exception e) {}
                }

                com.turfchai.venue.dto.owner.CreateVenueRequest venueReq = new com.turfchai.venue.dto.owner.CreateVenueRequest(
                    request.getVenueName(), // name
                    request.getArea(), // address
                    request.getArea(), // area
                    new java.math.BigDecimal("23.8103"), // lat
                    new java.math.BigDecimal("90.4125"), // lng
                    new java.math.BigDecimal("2000"), // basePrice
                    "06:00", // openTime
                    "23:00", // closeTime
                    "floodlights,parking", // amenities
                    request.getOwnerPhone(), // contactPhone
                    request.getOwnerEmail(), // contactEmail
                    "FULL_ONLY", // depositPolicy
                    "FREE_24H_50_6H", // cancelPolicy
                    false, // allowSplitPayment
                    "Standard rules", // rules
                    photos, // photos
                    false // mlPricingEnabled
                );

                venueManagementService.createVenue(request.getOwnerUserId(), venueReq);
                break;
            case "REJECT":
                if (!currentStatus.equals("PENDING") && !currentStatus.equals("CHANGES_REQUESTED")) {
                    throw new IllegalStateException("Cannot reject request in status: " + currentStatus);
                }
                request.setStatus("REJECTED");
                Long ownerIdToDelete = request.getOwnerUserId();
                turfRequestRepository.delete(request);
                userRepository.deleteById(ownerIdToDelete);
                return; // End immediately as entities are deleted
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
