package com.banking.dto;

import com.banking.model.Account;
import com.banking.model.User;
import jakarta.validation.constraints.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Request/response bodies for authentication and the signed-in user's profile. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public static final String PASSWORD_RULE = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,64}$";
    public static final String PASSWORD_MESSAGE = "Use 8+ characters with upper and lower case letters, a number and a symbol";
    public static final String PAN_RULE = "^[A-Z]{5}[0-9]{4}[A-Z]$";
    public static final String PHONE_RULE = "^(\\+91[- ]?)?[6-9]\\d{4}[- ]?\\d{5}$";

    public record UserDto(
            Long id,
            String customerId,
            String fullName,
            String email,
            String phone,
            User.Role role,
            User.UserStatus status,
            String panNumber,
            String aadhaarMasked,
            LocalDate dateOfBirth,
            String address,
            boolean hasTransactionPin,
            LocalDateTime lastLoginAt,
            LocalDateTime createdAt) {
    }

    public record AuthResponse(String token, UserDto user) {
    }

    public record LoginRequest(
            @NotBlank(message = "Enter your email or customer ID") String username,
            @NotBlank(message = "Enter your password") String password) {
    }

    public record RegisterRequest(
            @NotBlank(message = "Enter your full name") @Size(max = 100) String fullName,
            @NotBlank(message = "Enter your email") @Email(message = "Enter a valid email") @Size(max = 100) String email,
            @NotBlank(message = "Enter your mobile number") @Pattern(regexp = PHONE_RULE, message = "Enter a valid 10-digit Indian mobile number") String phone,
            @NotBlank(message = "Choose a password") @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password,
            @NotBlank(message = "Enter your PAN") @Pattern(regexp = PAN_RULE, message = "PAN must look like ABCDE1234F") String panNumber,
            @NotBlank(message = "Enter your Aadhaar number") @Pattern(regexp = "^\\d{12}$", message = "Aadhaar must be 12 digits") String aadhaarNumber,
            @NotNull(message = "Enter your date of birth") @Past(message = "Date of birth must be in the past") LocalDate dateOfBirth,
            @NotBlank(message = "Enter your address") @Size(max = 255) String address,
            @NotNull(message = "Choose an account type") Account.AccountType accountType) {
    }

    public record ProfileUpdateRequest(
            @NotBlank(message = "Enter your mobile number") @Pattern(regexp = PHONE_RULE, message = "Enter a valid 10-digit Indian mobile number") String phone,
            @NotBlank(message = "Enter your address") @Size(max = 255) String address) {
    }

    public record ChangePasswordRequest(
            @NotBlank(message = "Enter your current password") String currentPassword,
            @NotBlank(message = "Choose a new password") @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String newPassword) {
    }

    public record SetPinRequest(
            @NotBlank(message = "Enter your login password") String password,
            @NotBlank(message = "Enter a PIN") @Pattern(regexp = "^\\d{6}$", message = "PIN must be exactly 6 digits") String pin) {
    }
}
