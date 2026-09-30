package com.banking.service;

import com.banking.dto.AdminDtos.SettingDto;
import com.banking.dto.AuthDtos.UserDto;
import com.banking.dto.BankingDtos.*;
import com.banking.model.*;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/** Entity to API conversions. Call inside a transaction; some fields read lazy associations. */
@Component
public class DtoMapper {

    public UserDto user(User user) {
        String aadhaar = user.getAadhaarNumber();
        return new UserDto(
                user.getId(),
                user.getCustomerId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole(),
                user.getStatus(),
                user.getPanNumber(),
                aadhaar != null && aadhaar.length() >= 4 ? "XXXX-XXXX-" + aadhaar.substring(aadhaar.length() - 4) : null,
                user.getDateOfBirth(),
                user.getAddress(),
                user.getTransactionPinHash() != null,
                user.getLastLoginAt(),
                user.getCreatedAt());
    }

    public AccountDto account(Account account) {
        return new AccountDto(
                account.getId(),
                account.getAccountNumber(),
                account.getIfscCode(),
                account.getBranchName(),
                account.getAccountType(),
                account.getBalance(),
                account.getCurrency(),
                account.getStatus(),
                account.getInterestRate(),
                account.getNomineeName(),
                account.getUpiId(),
                account.getUser().getFullName(),
                account.getOpenedAt());
    }

    public TransactionDto transaction(Transaction txn) {
        return new TransactionDto(
                txn.getId(),
                txn.getReferenceId(),
                txn.getAccount().getId(),
                txn.getAccount().getAccountNumber(),
                txn.getDirection(),
                txn.getChannel(),
                txn.getAmount(),
                txn.getBalanceAfter(),
                txn.getCounterpartyName(),
                txn.getCounterpartyAccount(),
                txn.getDescription(),
                txn.getStatus(),
                txn.getCreatedAt());
    }

    public BeneficiaryDto beneficiary(Beneficiary beneficiary, boolean internal) {
        return new BeneficiaryDto(
                beneficiary.getId(),
                beneficiary.getName(),
                beneficiary.getNickname(),
                beneficiary.getAccountNumber(),
                beneficiary.getIfscCode(),
                beneficiary.getBankName(),
                beneficiary.getTransferLimit(),
                internal,
                beneficiary.getCreatedAt().plusHours(BankConstants.PAYEE_COOLING_HOURS),
                beneficiary.getCreatedAt());
    }

    public FixedDepositDto fixedDeposit(FixedDeposit fd) {
        BigDecimal currentValue = switch (fd.getStatus()) {
            case ACTIVE -> {
                long days = Math.max(0, ChronoUnit.DAYS.between(fd.getStartDate(), LocalDate.now()));
                BigDecimal accrued = FinanceMath.fdValueAfterDays(fd.getPrincipal(), fd.getInterestRate(), days);
                yield accrued.min(fd.getMaturityAmount());
            }
            case MATURED -> fd.getMaturityAmount();
            case CLOSED -> fd.getPayoutAmount() != null ? fd.getPayoutAmount() : fd.getPrincipal();
        };
        return new FixedDepositDto(
                fd.getId(),
                fd.getFdNumber(),
                fd.getPrincipal(),
                fd.getInterestRate(),
                fd.getTenureMonths(),
                fd.getStartDate(),
                fd.getMaturityDate(),
                fd.getMaturityAmount(),
                currentValue,
                fd.getStatus(),
                fd.getSourceAccount().getAccountNumber(),
                fd.isAutoRenew(),
                fd.getClosedAt(),
                fd.getPayoutAmount());
    }

    public LoanDto loan(Loan loan) {
        return new LoanDto(
                loan.getId(),
                loan.getLoanNumber(),
                loan.getType(),
                loan.getPrincipal(),
                loan.getInterestRate(),
                loan.getTenureMonths(),
                loan.getEmi(),
                loan.getOutstanding(),
                loan.getEmisPaid(),
                loan.getStatus(),
                loan.getPurpose(),
                loan.getMonthlyIncome(),
                loan.getDisbursementAccount().getAccountNumber(),
                loan.getUser().getFullName(),
                loan.getAppliedAt(),
                loan.getDecidedAt(),
                loan.getNextDueDate(),
                loan.getRemarks());
    }

    public CardDto card(DebitCard card) {
        return new CardDto(
                card.getId(),
                card.getAccount().getId(),
                card.getAccount().getAccountNumber(),
                card.getAccount().getUser().getFullName().toUpperCase(),
                card.getFirst4() + " •••• •••• " + card.getLast4(),
                card.getLast4(),
                card.getNetwork(),
                card.getVariant(),
                card.getExpiry(),
                card.getStatus(),
                card.isOnlineEnabled(),
                card.isInternationalEnabled(),
                card.isContactlessEnabled(),
                card.isAtmEnabled(),
                card.getAtmLimit(),
                card.getPosLimit(),
                card.getOnlineLimit(),
                card.getMaxLimit());
    }

    public BillPaymentDto billPayment(BillPayment payment) {
        return new BillPaymentDto(
                payment.getId(),
                payment.getReferenceId(),
                payment.getCategory(),
                payment.getBillerName(),
                payment.getConsumerNumber(),
                payment.getAmount(),
                payment.getAccount().getAccountNumber(),
                payment.getStatus(),
                payment.getCreatedAt());
    }

    public ServiceRequestDto serviceRequest(ServiceRequest request) {
        return new ServiceRequestDto(
                request.getId(),
                request.getTicketNumber(),
                request.getType(),
                request.getAccount() != null ? request.getAccount().getAccountNumber() : null,
                request.getDetails(),
                request.getStatus(),
                request.getRemarks(),
                request.getUser().getFullName(),
                request.getCreatedAt(),
                request.getUpdatedAt());
    }

    public NotificationDto notification(Notification notification) {
        return new NotificationDto(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getCategory(),
                notification.isRead(),
                notification.getCreatedAt());
    }

    public SettingDto setting(SystemSetting setting) {
        return new SettingDto(setting.getSettingKey(), setting.getSettingValue(), setting.getDescription());
    }

    public static boolean isCooling(Beneficiary beneficiary) {
        return beneficiary.getCreatedAt().plusHours(BankConstants.PAYEE_COOLING_HOURS).isAfter(LocalDateTime.now());
    }
}
