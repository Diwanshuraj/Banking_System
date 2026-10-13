package com.banking.jdbc;

import java.time.LocalDateTime;

/** One line in the portal's activity log: who did what, from where, and when. */
public record AuditEvent(long userId, String action, String detail, String ipAddress, LocalDateTime createdAt) {

    public AuditEvent {
        detail = truncate(detail, 255);
        ipAddress = truncate(ipAddress, 45);
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
