package com.turfchai.service;

import com.turfchai.model.Notification;
import com.turfchai.model.User;
import com.turfchai.repository.NotificationRepository;
import com.turfchai.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.host:}")
    private String mailHost;

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

        dispatchEmail(userId, title, body);
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

    // ponytail: @Async on a thread pool. ceiling: switch to message queue (SQS/RabbitMQ) for >1000 notifs/min
    @Async
    protected void dispatchEmail(Long userId, String subject, String text) {
        if (!StringUtils.hasText(mailHost)) {
            log.info("SMTP not configured. Skipping email dispatch: [{}] {}", subject, text);
            return;
        }

        userRepository.findById(userId).ifPresent(user -> {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(user.getEmail());
                message.setSubject(subject);
                message.setText(text);
                mailSender.send(message);
                log.info("Email dispatched to {}", user.getEmail());
            } catch (Exception e) {
                log.error("Failed to send email to {}", user.getEmail(), e);
            }
        });
    }
}
