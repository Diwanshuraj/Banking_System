package com.banking.dto;

import com.banking.model.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Request/response bodies for customer banking features. */
public final class BankingDtos {

    private BankingDtos() {
    }

    public static final String PIN_RULE = "^\\d{6}$";
    public static final String PIN_MESSAGE = "Enter your 6-digit transaction PIN";

    // ---------- Accounts & transactions ----------

    public record AccountDto(
            Long id,
            String accountNumber,
            String ifscCode,
            String branchName,
            Account.AccountType accountType,
            BigDecimal balance,
            String currency,
            Account.AccountStatus status,
            BigDecimal interestRate,
            String nomineeName,
            String upiId,
            String holderName,
            LocalDateTime openedAt) {
    }

    public record OpenAccountRequest(
            @NotNull(message = "Choose an account type") Account.AccountType accountType,
            @Size(max = 100) String nomineeName) {
    }

    public record TransactionDto(
            Long id,
            String referenceId,
            Long accountId,
            String accountNumber,
            Transaction.Direction direction,
            Transaction.Channel channel,
            BigDecimal amount,
            BigDecimal balanceAfter,
            String counterpartyName,
            String counterpartyAccount,
            String description,
            Transaction.TxnStatus status,
            LocalDateTime createdAt) {
    }

    public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    }

    public record TransactionFilter(
            Long accountId,
            LocalDate from,
            LocalDate to,
            Transaction.Direction direction,
            Transaction.Channel channel,
            String q) {
    }

    // ---------- Payees & transfers ----------

    public record BeneficiaryDto(
            Long id,
            String name,
            String nickname,
            String accountNumber,
            String ifscCode,
            String bankName,
            BigDecimal transferLimit,
            boolean internal,
            LocalDateTime coolingPeriodEndsAt,
            LocalDateTime createdAt) {
    }

    public record BeneficiaryRequest(
            @NotBlank(message = "Enter the payee's name") @Size(max = 100) String name,
            @Size(max = 50) String nickname,
            @NotBlank(message = "Enter the account number") @Pattern(regexp = "^\\d{9,18}$", message = "Account number must be 9 to 18 digits") String accountNumber,
            @NotBlank(message = "Enter the IFSC") @Pattern(regexp = "^[A-Za-z]{4}0[A-Za-z0-9]{6}$", message = "IFSC must look like HDFC0001234") String ifscCode,
            @NotNull(message = "Set a transfer limit") @DecimalMin(value = "1", message = "Limit must be at least ₹1") @DecimalMax(value = "1000000", message = "Limit can be at most ₹10,00,000") BigDecimal transferLimit) {
    }

    public enum TransferMode {
        INTERNAL, IMPS, NEFT, RTGS, UPI
    }

    public record TransferRequest(
            @NotNull(message = "Choose the account to pay from") Long fromAccountId,
            @NotNull(message = "Choose a transfer mode") TransferMode mode,
            Long beneficiaryId,
            Long toAccountId,
            @Size(max = 60) String upiId,
            @NotNull(message = "Enter an amount") @DecimalMin(value = "1", message = "Amount must be at least ₹1") @Digits(integer = 13, fraction = 2, message = "Use at most 2 decimal places") BigDecimal amount,
            @Size(max = 100) String remarks,
            @NotBlank(message = PIN_MESSAGE) @Pattern(regexp = PIN_RULE, message = PIN_MESSAGE) String pin) {
    }

    public record TransferReceipt(
            String referenceId,
            TransferMode mode,
            BigDecimal amount,
            String fromAccountNumber,
            String toName,
            String toAccount,
            Transaction.TxnStatus status,
            BigDecimal balanceAfter,
            LocalDateTime timestamp,
            String message) {
    }

    public record UpiLookup(String upiId, String name, String bankName) {
    }

    public record TransferLimits(
            BigDecimal dailyLimit,
            BigDecimal usedToday,
            BigDecimal upiDailyLimit,
            BigDecimal upiUsedToday,
            BigDecimal impsMax,
            BigDecimal upiMax,
            BigDecimal rtgsMin,
            BigDecimal newPayeeLimit) {
    }

    // ---------- Fixed deposits ----------

    public record FixedDepositDto(
            Long id,
            String fdNumber,
            BigDecimal principal,
            BigDecimal interestRate,
            int tenureMonths,
            LocalDate startDate,
            LocalDate maturityDate,
            BigDecimal maturityAmount,
            BigDecimal currentValue,
            FixedDeposit.FdStatus status,
            String sourceAccountNumber,
            boolean autoRenew,
            LocalDateTime closedAt,
            BigDecimal payoutAmount) {
    }

    public record FdRate(int minMonths, int maxMonths, String label, BigDecimal rate, BigDecimal seniorRate) {
    }

    public record OpenFdRequest(
            @NotNull(message = "Choose the account to fund the deposit") Long sourceAccountId,
            @NotNull(message = "Enter an amount") @DecimalMin(value = "1000", message = "Minimum deposit is ₹1,000") @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Min(value = 1, message = "Tenure must be at least 1 month") @Max(value = 120, message = "Tenure can be at most 120 months") int tenureMonths,
            boolean autoRenew,
            @NotBlank(message = PIN_MESSAGE) @Pattern(regexp = PIN_RULE, message = PIN_MESSAGE) String pin) {
    }

    public record PinRequest(@NotBlank(message = PIN_MESSAGE) @Pattern(regexp = PIN_RULE, message = PIN_MESSAGE) String pin) {
    }

    // ---------- Loans ----------

    public record LoanProduct(
            Loan.LoanType type,
            String name,
            BigDecimal rate,
            BigDecimal maxAmount,
            int maxTenureMonths,
            BigDecimal processingFeePct,
            String description) {
    }

    public record LoanDto(
            Long id,
            String loanNumber,
            Loan.LoanType type,
            BigDecimal principal,
            BigDecimal interestRate,
            int tenureMonths,
            BigDecimal emi,
            BigDecimal outstanding,
            int emisPaid,
            Loan.LoanStatus status,
            String purpose,
            BigDecimal monthlyIncome,
            String disbursementAccountNumber,
            String applicantName,
            LocalDateTime appliedAt,
            LocalDateTime decidedAt,
            LocalDate nextDueDate,
            String remarks) {
    }

    public record LoanApplicationRequest(
            @NotNull(message = "Choose a loan type") Loan.LoanType type,
            @NotNull(message = "Enter the loan amount") @DecimalMin(value = "10000", message = "Minimum loan amount is ₹10,000") @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @Min(value = 3, message = "Tenure must be at least 3 months") int tenureMonths,
            @NotBlank(message = "Tell us the purpose of the loan") @Size(max = 255) String purpose,
            @NotNull(message = "Enter your monthly income") @DecimalMin(value = "1", message = "Enter your monthly income") BigDecimal monthlyIncome,
            @NotNull(message = "Choose the account to receive the loan") Long disbursementAccountId) {
    }

    public record LoanRepayRequest(
            @NotNull(message = "Choose the account to pay from") Long accountId,
            @NotNull(message = "Enter an amount") @DecimalMin(value = "1", message = "Amount must be at least ₹1") @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @NotBlank(message = PIN_MESSAGE) @Pattern(regexp = PIN_RULE, message = PIN_MESSAGE) String pin) {
    }

    // ---------- Cards ----------

    public record CardDto(
            Long id,
            Long accountId,
            String accountNumber,
            String cardHolder,
            String maskedNumber,
            String last4,
            DebitCard.Network network,
            String variant,
            String expiry,
            DebitCard.CardStatus status,
            boolean onlineEnabled,
            boolean internationalEnabled,
            boolean contactlessEnabled,
            boolean atmEnabled,
            BigDecimal atmLimit,
            BigDecimal posLimit,
            BigDecimal onlineLimit,
            BigDecimal maxLimit) {
    }

    public record CardControlsRequest(
            boolean onlineEnabled,
            boolean internationalEnabled,
            boolean contactlessEnabled,
            boolean atmEnabled,
            @NotNull @DecimalMin("0") BigDecimal atmLimit,
            @NotNull @DecimalMin("0") BigDecimal posLimit,
            @NotNull @DecimalMin("0") BigDecimal onlineLimit) {
    }

    // ---------- Bills ----------

    public record BillerCategory(BillPayment.BillCategory category, String label, String consumerLabel, List<String> billers) {
    }

    public record BillPaymentRequest(
            @NotNull(message = "Choose the account to pay from") Long accountId,
            @NotNull(message = "Choose a category") BillPayment.BillCategory category,
            @NotBlank(message = "Choose a biller") @Size(max = 100) String billerName,
            @NotBlank(message = "Enter the consumer number") @Size(min = 4, max = 40, message = "Enter a valid consumer number") String consumerNumber,
            @NotNull(message = "Enter an amount") @DecimalMin(value = "1", message = "Amount must be at least ₹1") @DecimalMax(value = "200000", message = "Bill payments are limited to ₹2,00,000") @Digits(integer = 13, fraction = 2) BigDecimal amount,
            @NotBlank(message = PIN_MESSAGE) @Pattern(regexp = PIN_RULE, message = PIN_MESSAGE) String pin) {
    }

    public record BillPaymentDto(
            Long id,
            String referenceId,
            BillPayment.BillCategory category,
            String billerName,
            String consumerNumber,
            BigDecimal amount,
            String accountNumber,
            Transaction.TxnStatus status,
            LocalDateTime createdAt) {
    }

    // ---------- Service requests & notifications ----------

    public record ServiceRequestDto(
            Long id,
            String ticketNumber,
            ServiceRequest.RequestType type,
            String accountNumber,
            String details,
            ServiceRequest.RequestStatus status,
            String remarks,
            String customerName,
            LocalDateTime createdAt,
            LocalDateTime updatedAt) {
    }

    public record ServiceRequestCreate(
            @NotNull(message = "Choose a request type") ServiceRequest.RequestType type,
            Long accountId,
            @NotBlank(message = "Add some details") @Size(max = 500) String details) {
    }

    public record NotificationDto(Long id, String title, String message, Notification.Category category, boolean read, LocalDateTime createdAt) {
    }

    // ---------- Dashboard ----------

    public record MonthlyFlow(String month, BigDecimal credit, BigDecimal debit) {
    }

    public record DashboardDto(
            List<AccountDto> accounts,
            BigDecimal totalBalance,
            List<TransactionDto> recentTransactions,
            List<MonthlyFlow> monthly,
            int fdCount,
            BigDecimal fdTotal,
            int loanCount,
            BigDecimal loanOutstanding,
            long unreadNotifications,
            TransferLimits limits) {
    }
}
