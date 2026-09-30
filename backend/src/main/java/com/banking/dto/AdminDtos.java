package com.banking.dto;

import com.banking.dto.AuthDtos.UserDto;
import com.banking.dto.BankingDtos.AccountDto;
import com.banking.model.Account;
import com.banking.model.ServiceRequest;
import com.banking.model.Transaction;
import com.banking.model.User;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static com.banking.dto.AuthDtos.*;

/** Request/response bodies for the branch admin console. */
public final class AdminDtos {

    private AdminDtos() {
    }

    public record ChannelStat(Transaction.Channel channel, long count, BigDecimal amount) {
    }

    public record DailyVolume(LocalDate date, BigDecimal amount, long count) {
    }

    public record AdminMetrics(
            long totalCustomers,
            long activeAccounts,
            long frozenAccounts,
            BigDecimal totalDeposits,
            BigDecimal todayVolume,
            long todayTransactions,
            long pendingLoans,
            long openRequests,
            BigDecimal loanBook,
            List<ChannelStat> channelBreakdown,
            List<DailyVolume> dailyVolume) {
    }

    /** Serialised flat: all user fields plus "accounts". */
    public record AdminUserDetail(@JsonUnwrapped UserDto user, List<AccountDto> accounts) {
    }

    public record AdminCreateCustomerRequest(
            @NotBlank(message = "Enter the full name") @Size(max = 100) String fullName,
            @NotBlank(message = "Enter the email") @Email(message = "Enter a valid email") @Size(max = 100) String email,
            @NotBlank(message = "Enter the mobile number") @Pattern(regexp = PHONE_RULE, message = "Enter a valid 10-digit Indian mobile number") String phone,
            @NotBlank(message = "Set an initial password") @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password,
            @NotBlank(message = "Enter the PAN") @Pattern(regexp = PAN_RULE, message = "PAN must look like ABCDE1234F") String panNumber,
            @NotBlank(message = "Enter the Aadhaar number") @Pattern(regexp = "^\\d{12}$", message = "Aadhaar must be 12 digits") String aadhaarNumber,
            @NotNull(message = "Enter the date of birth") @Past(message = "Date of birth must be in the past") LocalDate dateOfBirth,
            @NotBlank(message = "Enter the address") @Size(max = 255) String address,
            @NotNull(message = "Choose an account type") Account.AccountType accountType,
            @NotNull(message = "Enter the opening deposit") @DecimalMin(value = "0", message = "Opening deposit can't be negative") @Digits(integer = 13, fraction = 2) BigDecimal openingDeposit) {
    }

    public record UserStatusRequest(@NotNull User.UserStatus status) {
    }

    public record AccountStatusRequest(@NotNull Account.AccountStatus status) {
    }

    public enum CashType {
        DEPOSIT, WITHDRAWAL
    }

    public record CashRequest(
            @NotNull CashType type,
            @NotNull(message = "Enter an amount") @DecimalMin(value = "1", message = "Amount must be at least ₹1") @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Size(max = 100) String remarks) {
    }

    public record LoanDecisionRequest(boolean approve, @Size(max = 255) String remarks) {
    }

    public record ServiceRequestUpdate(@NotNull ServiceRequest.RequestStatus status, @Size(max = 255) String remarks) {
    }

    public record SettingDto(String key, String value, String description) {
    }

    public record SettingUpdate(@NotBlank(message = "Enter a value") @Size(max = 255) String value) {
    }

    public record InterestResult(int accounts, BigDecimal total) {
    }
}
