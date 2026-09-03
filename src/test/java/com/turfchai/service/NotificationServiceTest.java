package com.turfchai.service;

import com.turfchai.model.Notification;
import com.turfchai.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void testSend_SavesToDb() {
        notificationService.send(300L, "SYSTEM", "Hello", "Body text", null);

        verify(notificationRepository, times(1)).save(any(Notification.class));
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
