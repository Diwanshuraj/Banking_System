package com.banking.service;

import com.banking.dto.AuthDtos.*;
import com.banking.exception.ApiException;
import com.banking.model.Notification;
import com.banking.model.User;
import com.banking.repository.UserRepository;
import com.banking.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Optional;

/** Login with lockout, online sign-up, profile and password changes, and the transaction PIN. */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OnboardingService onboarding;
    private final NotificationService notifications;
    private final SettingsService settings;
    private final DtoMapper mapper;

    /** Loads a user by id. */
    public User loadUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Please log in again."));
    }

    /** Failed attempts must be saved even though the login fails, hence noRollbackFor. */
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse login(LoginRequest request) {
        String username = request.username().trim();
        Optional<User> found = username.matches("\\d{11}")
                ? userRepository.findByCustomerId(username)
                : userRepository.findByEmailIgnoreCase(username.toLowerCase(Locale.ROOT));
        User user = found.orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Incorrect username or password."));

        if (user.getStatus() == User.UserStatus.LOCKED) {
            throw new ApiException(HttpStatus.LOCKED,
                    "Your internet banking access is locked after too many failed attempts. Please contact your branch to unlock it.");
        }
        if (user.getStatus() == User.UserStatus.SUSPENDED) {
            throw ApiException.forbidden("Your internet banking access is suspended. Please contact your branch.");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            int maxAttempts = settings.integer(SettingsService.Key.MAX_LOGIN_ATTEMPTS);
            user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
            int remaining = maxAttempts - user.getFailedLoginAttempts();
            if (remaining <= 0 && user.getRole() == User.Role.ROLE_CUSTOMER) {
                user.setStatus(User.UserStatus.LOCKED);
                notifications.notify(user, Notification.Category.SECURITY, "Internet banking locked",
                        "Your access was locked after " + maxAttempts + " failed login attempts. Visit your branch to unlock it.");
                throw new ApiException(HttpStatus.LOCKED,
                        "Too many failed attempts. Your internet banking access is now locked. Please contact your branch.");
            }
            throw new ApiException(HttpStatus.UNAUTHORIZED, remaining > 0 && remaining <= 2
                    ? "Incorrect username or password. " + remaining + " attempt" + (remaining == 1 ? "" : "s") + " left before your access is locked."
                    : "Incorrect username or password.");
        }

        user.setFailedLoginAttempts(0);
        user.setLastLoginAt(LocalDateTime.now());
        if (user.getRole() == User.Role.ROLE_CUSTOMER) {
            notifications.notify(user, Notification.Category.SECURITY, "New login to internet banking",
                    "If this wasn't you, change your password immediately and call 1800-123-4567.");
        }
        return new AuthResponse(jwtService.issue(user), mapper.user(user));
    }

    /** Creates a customer from the sign-up form, opens their first account and signs them in. */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        User user = onboarding.createCustomer(new OnboardingService.NewCustomer(
                request.fullName(), request.email(), request.phone(), request.password(), request.panNumber(),
                request.aadhaarNumber(), request.dateOfBirth(), request.address()));
        onboarding.openAccount(user, request.accountType(), null);
        user.setLastLoginAt(LocalDateTime.now());
        return new AuthResponse(jwtService.issue(user), mapper.user(user));
    }

    /** The signed-in user's profile. */
    @Transactional(readOnly = true)
    public UserDto me(Long userId) {
        return mapper.user(loadUser(userId));
    }

    /** Updates the phone number and address. */
    @Transactional
    public UserDto updateProfile(Long userId, ProfileUpdateRequest request) {
        User user = loadUser(userId);
        user.setPhone(OnboardingService.normalizePhone(request.phone()));
        user.setAddress(request.address().trim());
        notifications.notify(user, Notification.Category.SECURITY, "Profile updated",
                "Your contact details were changed. If this wasn't you, contact us immediately.");
        return mapper.user(user);
    }

    /** Changes the password after checking the current one. */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = loadUser(userId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Your current password is incorrect.");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Choose a password you haven't used just now.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        notifications.notify(user, Notification.Category.SECURITY, "Password changed",
                "Your internet banking password was changed. If this wasn't you, contact us immediately.");
    }

    /** Sets or changes the 6-digit transaction PIN after checking the login password. */
    @Transactional
    public void setPin(Long userId, SetPinRequest request) {
        User user = loadUser(userId);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw ApiException.badRequest("Your login password is incorrect.");
        }
        if (request.pin().chars().distinct().count() == 1) {
            throw ApiException.badRequest("Choose a PIN that isn't a single repeated digit.");
        }
        boolean isChange = user.getTransactionPinHash() != null;
        user.setTransactionPinHash(passwordEncoder.encode(request.pin()));
        notifications.notify(user, Notification.Category.SECURITY, isChange ? "Transaction PIN changed" : "Transaction PIN set",
                "Your 6-digit transaction PIN is ready to authorise payments. Never share it with anyone.");
    }

    /** Every money movement calls this before touching balances. */
    public void requirePin(User user, String pin) {
        if (user.getTransactionPinHash() == null) {
            throw ApiException.badRequest("Set your transaction PIN under Profile & security before making payments.");
        }
        if (pin == null || !passwordEncoder.matches(pin, user.getTransactionPinHash())) {
            throw ApiException.badRequest("Incorrect transaction PIN.");
        }
    }
}
