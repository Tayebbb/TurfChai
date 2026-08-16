package com.turfchai.dto.response;

import com.turfchai.model.Notification;

import java.time.OffsetDateTime;

/**
 * A notification as its recipient sees it. {@code userId} is deliberately
 * omitted: the list is already scoped to the caller, so echoing the owning
 * user id adds nothing but an identifier to correlate against.
 */
public record NotificationResponse(
        Long id,
        String type,
        String title,
        String body,
        Boolean isRead,
        String link,
        OffsetDateTime createdAt) {

    public static NotificationResponse from(Notification notification) {
        if (notification == null) {
            return null;
        }
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getTitle(),
                notification.getBody(),
                notification.getIsRead(),
                notification.getLink(),
                notification.getCreatedAt());
    }
}
