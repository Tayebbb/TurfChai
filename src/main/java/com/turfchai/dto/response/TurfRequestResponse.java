package com.turfchai.dto.response;

import com.turfchai.model.TurfRequest;

import java.time.OffsetDateTime;

/** Listing-request view shared by the admin queue and the owner's own list. */
public record TurfRequestResponse(
        Long id,
        String requestCode,
        Long venueId,
        Long ownerUserId,
        String venueName,
        String area,
        Integer pitchCount,
        String sportsCsv,
        String ownerPhone,
        String ownerEmail,
        String docTradeLicense,
        String docOwnerNid,
        String docUtilityBill,
        String photosJson,
        String status,
        String adminNote,
        Long reviewedBy,
        OffsetDateTime reviewedAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static TurfRequestResponse from(TurfRequest request) {
        if (request == null) {
            return null;
        }
        return new TurfRequestResponse(
                request.getId(),
                request.getRequestCode(),
                request.getVenueId(),
                request.getOwnerUserId(),
                request.getVenueName(),
                request.getArea(),
                request.getPitchCount(),
                request.getSportsCsv(),
                request.getOwnerPhone(),
                request.getOwnerEmail(),
                request.getDocTradeLicense(),
                request.getDocOwnerNid(),
                request.getDocUtilityBill(),
                request.getPhotosJson(),
                request.getStatus(),
                request.getAdminNote(),
                request.getReviewedBy(),
                request.getReviewedAt(),
                request.getCreatedAt(),
                request.getUpdatedAt());
    }
}
