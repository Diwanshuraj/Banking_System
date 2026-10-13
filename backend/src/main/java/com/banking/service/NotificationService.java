package com.banking.service;

import com.banking.dto.BankingDtos.NotificationDto;
import com.banking.exception.ApiException;
import com.banking.model.Notification;
import com.banking.model.User;
import com.banking.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** In-app notifications for transactions and security events. */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repository;
    private final DtoMapper mapper;

    /** Creates a notification for the user. */
    public void notify(User user, Notification.Category category, String title, String message) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setCategory(category);
        notification.setTitle(title);
        notification.setMessage(message);
        repository.save(notification);
    }

    /** The user's notifications. */
    @Transactional(readOnly = true)
    public List<NotificationDto> list(Long userId) {
        return repository.findTop100ByUserIdOrderByCreatedAtDescIdDesc(userId).stream().map(mapper::notification).toList();
    }

    /** Marks one of the user's notifications as read. */
    @Transactional
    public void markRead(Long userId, Long id) {
        Notification notification = repository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.notFound("Notification not found"));
        notification.setRead(true);
    }

    /** Marks all of the user's notifications as read. */
    @Transactional
    public void markAllRead(Long userId) {
        repository.markAllRead(userId);
    }
}
