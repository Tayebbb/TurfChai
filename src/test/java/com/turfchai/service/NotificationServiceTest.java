package com.turfchai.service;

import com.turfchai.model.Notification;
import com.turfchai.model.User;
import com.turfchai.repository.NotificationRepository;
import com.turfchai.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private NotificationService notificationService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(notificationService, "mailHost", "smtp.test.com");
    }

    @Test
    void testSend_SavesToDbAndEmails() {
        User mockUser = new User();
        mockUser.setId(300L);
        mockUser.setEmail("player@test.com");
        
        when(userRepository.findById(300L)).thenReturn(Optional.of(mockUser));

        notificationService.send(300L, "SYSTEM", "Hello", "Body text", null);

        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    void testSend_SkipsEmailIfNoHost() {
        ReflectionTestUtils.setField(notificationService, "mailHost", ""); // blank host

        notificationService.send(300L, "SYSTEM", "Hello", "Body text", null);

        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(userRepository, never()).findById(any());
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void testMarkRead_Success() {
        Notification notif = new Notification();
        notif.setId(10L);
        notif.setUserId(300L);
        notif.setIsRead(false);

        when(notificationRepository.findById(10L)).thenReturn(Optional.of(notif));

        notificationService.markRead(10L, 300L);

        assertTrue(notif.getIsRead());
        verify(notificationRepository, times(1)).save(notif);
    }

    @Test
    void testMarkRead_FailsOnWrongUser() {
        Notification notif = new Notification();
        notif.setId(10L);
        notif.setUserId(300L); // belongs to user 300

        when(notificationRepository.findById(10L)).thenReturn(Optional.of(notif));

        assertThrows(IllegalArgumentException.class, () -> notificationService.markRead(10L, 999L));
        verify(notificationRepository, never()).save(any());
    }
}
