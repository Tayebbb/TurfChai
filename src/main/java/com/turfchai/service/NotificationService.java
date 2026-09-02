package com.turfchai.service;

import com.turfchai.model.Notification;
import com.turfchai.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;

    @Transactional
    public void send(Long userId, String type, String title, String body, String link) {
        Notification notif = Notification.builder()
                .userId(userId)
                .type(type)
                .title(title)
                .body(body)
                .link(link)
                .isRead(false)
                .build();
        notificationRepository.save(notif);
        log.info("Saved {} notification for user {}", type, userId);
    }

    /**
     * Records a notification unless the recipient already has one of the same
     * kind about the same thing. State transitions get retried and the reminder
     * job runs repeatedly; neither may stack duplicates in the player's feed.
     *
     * @return whether a notification was actually written
     */
    @Transactional
    public boolean sendOnce(Long userId, String type, String title, String body, String link) {
        if (userId == null || link == null || link.isBlank()) {
            return false;
        }
        if (notificationRepository.existsByUserIdAndTypeAndLink(userId, type, link)) {
            return false;
        }
        send(userId, type, title, body, link);
        return true;
    }

    /**
     * Records a notification in its own transaction, so it survives the
     * rollback of the operation that failed. Only for telling somebody that
     * something did <em>not</em> happen.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void sendDetached(Long userId, String type, String title, String body, String link) {
        send(userId, type, title, body, link);
    }

    @Transactional(readOnly = true)
    public List<Notification> listForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markRead(Long notificationId, Long userId) {
        Notification notif = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found"));

        if (!notif.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Cannot modify another user's notification");
        }

        notif.setIsRead(true);
        notificationRepository.save(notif);
    }

    @Transactional
    public void markAllRead(Long userId) {
        notificationRepository.markAllReadByUserId(userId);
    }
}
