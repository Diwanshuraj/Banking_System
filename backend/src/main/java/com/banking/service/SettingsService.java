package com.banking.service;

import com.banking.exception.ApiException;
import com.banking.model.SystemSetting;
import com.banking.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/** Admin-editable limits and switches, with safe defaults when a key is missing. */
@Service
@RequiredArgsConstructor
public class SettingsService {

    public enum Key {
        DAILY_TRANSFER_LIMIT("1000000", "Maximum a customer can send to others per day (₹)", Kind.AMOUNT),
        UPI_DAILY_LIMIT("100000", "Maximum UPI payments per customer per day (₹)", Kind.AMOUNT),
        UPI_MAX_PER_TXN("100000", "Maximum single UPI payment (₹)", Kind.AMOUNT),
        IMPS_MAX_PER_TXN("500000", "Maximum single IMPS transfer (₹)", Kind.AMOUNT),
        RTGS_MIN_AMOUNT("200000", "Minimum RTGS transfer (₹)", Kind.AMOUNT),
        NEW_PAYEE_LIMIT("25000", "Per-transfer cap for payees added in the last 24 hours (₹)", Kind.AMOUNT),
        MAX_LOGIN_ATTEMPTS("5", "Failed logins before a customer is locked out", Kind.INTEGER),
        SAVINGS_INTEREST_RATE("2.70", "Annual interest on savings and salary accounts (%)", Kind.AMOUNT),
        MAINTENANCE_MODE("false", "Pause all customer payments and transfers", Kind.BOOLEAN);

        final String defaultValue;
        final String description;
        final Kind kind;

        Key(String defaultValue, String description, Kind kind) {
            this.defaultValue = defaultValue;
            this.description = description;
            this.kind = kind;
        }
    }

    enum Kind {AMOUNT, INTEGER, BOOLEAN}

    private final SystemSettingRepository repository;

    public String get(Key key) {
        return repository.findBySettingKey(key.name()).map(SystemSetting::getSettingValue).orElse(key.defaultValue);
    }

    public BigDecimal amount(Key key) {
        return new BigDecimal(get(key));
    }

    public int integer(Key key) {
        return Integer.parseInt(get(key));
    }

    public boolean flag(Key key) {
        return Boolean.parseBoolean(get(key));
    }

    public void requireNotInMaintenance() {
        if (flag(Key.MAINTENANCE_MODE)) {
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Payments are paused for scheduled maintenance. Please try again later.");
        }
    }

    /** Creates any missing settings with their defaults. */
    @Transactional
    public void ensureDefaults() {
        for (Key key : Key.values()) {
            if (repository.findBySettingKey(key.name()).isEmpty()) {
                SystemSetting setting = new SystemSetting();
                setting.setSettingKey(key.name());
                setting.setSettingValue(key.defaultValue);
                setting.setDescription(key.description);
                repository.save(setting);
            }
        }
    }

    @Transactional(readOnly = true)
    public List<SystemSetting> all() {
        return repository.findAllByOrderBySettingKeyAsc();
    }

    @Transactional
    public SystemSetting update(String rawKey, String value) {
        Key key;
        try {
            key = Key.valueOf(rawKey);
        } catch (IllegalArgumentException ex) {
            throw ApiException.notFound("Unknown setting " + rawKey);
        }
        String normalized = value.trim();
        switch (key.kind) {
            case AMOUNT -> {
                try {
                    if (new BigDecimal(normalized).signum() < 0) throw ApiException.badRequest("Value can't be negative");
                } catch (NumberFormatException ex) {
                    throw ApiException.badRequest("Enter a number");
                }
            }
            case INTEGER -> {
                try {
                    if (Integer.parseInt(normalized) < 1) throw ApiException.badRequest("Value must be at least 1");
                } catch (NumberFormatException ex) {
                    throw ApiException.badRequest("Enter a whole number");
                }
            }
            case BOOLEAN -> {
                if (!normalized.equals("true") && !normalized.equals("false")) throw ApiException.badRequest("Value must be true or false");
            }
        }
        SystemSetting setting = repository.findBySettingKey(key.name()).orElseGet(() -> {
            SystemSetting created = new SystemSetting();
            created.setSettingKey(key.name());
            created.setDescription(key.description);
            return created;
        });
        setting.setSettingValue(normalized);
        return repository.save(setting);
    }
}
