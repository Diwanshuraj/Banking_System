package com.banking.service;

import com.banking.dto.BankingDtos.*;
import com.banking.exception.ApiException;
import com.banking.model.*;
import com.banking.repository.AccountRepository;
import com.banking.repository.BeneficiaryRepository;
import com.banking.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import static com.banking.service.SettingsService.Key;

@Service
@RequiredArgsConstructor
public class TransferService {

    /** Channels that count towards the customer's daily transfer limit (money leaving to other people). */
    private static final EnumSet<Transaction.Channel> LIMITED_CHANNELS = EnumSet.of(
            Transaction.Channel.UPI, Transaction.Channel.IMPS, Transaction.Channel.NEFT,
            Transaction.Channel.RTGS, Transaction.Channel.INTERNAL);

    private final AccountRepository accountRepository;
    private final BeneficiaryRepository beneficiaryRepository;
    private final TransactionRepository transactionRepository;
    private final LedgerService ledger;
    private final AuthService authService;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final IdGenerator ids;
    private final DtoMapper mapper;

    @Transactional(readOnly = true)
    public TransferLimits limits(Long userId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        return new TransferLimits(
                settings.amount(Key.DAILY_TRANSFER_LIMIT),
                transactionRepository.sumOutgoing(userId, LIMITED_CHANNELS, startOfDay),
                settings.amount(Key.UPI_DAILY_LIMIT),
                transactionRepository.sumOutgoing(userId, EnumSet.of(Transaction.Channel.UPI), startOfDay),
                settings.amount(Key.IMPS_MAX_PER_TXN),
                settings.amount(Key.UPI_MAX_PER_TXN),
                settings.amount(Key.RTGS_MIN_AMOUNT),
                settings.amount(Key.NEW_PAYEE_LIMIT));
    }

    @Transactional(readOnly = true)
    public UpiLookup lookupUpi(String upiId) {
        Account account = resolveUpi(upiId);
        return new UpiLookup(account.getUpiId(), maskName(account.getUser().getFullName()), BankConstants.BANK_NAME);
    }

    private Account resolveUpi(String upiId) {
        if (upiId == null || !upiId.trim().matches("^[A-Za-z0-9._-]{2,50}@[A-Za-z]{2,20}$")) {
            throw ApiException.badRequest("Enter a valid UPI ID, like name@bnb.");
        }
        return accountRepository.findByUpiIdIgnoreCase(upiId.trim())
                .filter(a -> a.getStatus() != Account.AccountStatus.CLOSED)
                .orElseThrow(() -> ApiException.notFound("No account is linked to this UPI ID."));
    }

    /** "Priya Verma" -> "Priya V." (what payment apps show before you pay). */
    private static String maskName(String fullName) {
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length == 1) return parts[0];
        return parts[0] + " " + parts[parts.length - 1].charAt(0) + ".";
    }

    private record Destination(Account internalAccount, String name, String accountLabel, Beneficiary payee, boolean self) {
    }

    @Transactional
    public TransferReceipt transfer(Long userId, TransferRequest request) {
        settings.requireNotInMaintenance();
        User user = authService.loadUser(userId);
        authService.requirePin(user, request.pin());
        BigDecimal amount = LedgerService.normalize(request.amount());

        Account from = accountRepository.findById(request.fromAccountId())
                .filter(a -> a.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Account not found"));

        Destination destination = resolveDestination(userId, from, request);
        checkLimits(userId, request.mode(), amount, destination);

        // Lock both sides (in id order) and move the money.
        Map<Long, Account> locked = destination.internalAccount() != null
                ? ledger.lock(from.getId(), destination.internalAccount().getId())
                : ledger.lock(from.getId());
        Account source = locked.get(from.getId());

        String reference = ids.reference(request.mode());
        Transaction.Channel channel = Transaction.Channel.valueOf(request.mode().name());
        String remarks = request.remarks() == null || request.remarks().isBlank() ? null : request.remarks().trim();
        String modeLabel = request.mode() == TransferMode.INTERNAL ? "Transfer" : request.mode().name();

        Transaction debit = ledger.debit(source, amount, new LedgerService.Entry(channel, reference,
                destination.name(), destination.accountLabel(),
                remarks != null ? remarks : modeLabel + " to " + destination.name(), destination.self()));

        if (destination.internalAccount() != null) {
            Account target = locked.get(destination.internalAccount().getId());
            ledger.credit(target, amount, new LedgerService.Entry(channel, reference,
                    user.getFullName(), request.mode() == TransferMode.UPI ? source.getUpiId() : source.getAccountNumber(),
                    remarks != null ? remarks : modeLabel + " from " + user.getFullName(), destination.self()));
            if (!destination.self()) {
                notifications.notify(target.getUser(), Notification.Category.TRANSACTION, "Money received",
                        "₹" + amount.toPlainString() + " credited to account ending " + LedgerService.last4(target)
                                + " from " + user.getFullName() + " via " + modeLabel + ". Ref " + reference + ".");
            }
        }

        notifications.notify(user, Notification.Category.TRANSACTION, "Money sent",
                "₹" + amount.toPlainString() + " debited from account ending " + LedgerService.last4(source)
                        + " to " + destination.name() + " via " + modeLabel + ". Ref " + reference + ".");

        String message = switch (request.mode()) {
            case NEFT -> "NEFT transfer accepted. It settles in the next half-hourly batch.";
            case RTGS -> "RTGS transfer completed in real time.";
            case UPI -> "UPI payment successful.";
            case IMPS -> "IMPS transfer completed instantly.";
            case INTERNAL -> "Transfer completed.";
        };
        return new TransferReceipt(reference, request.mode(), amount, source.getAccountNumber(), destination.name(),
                destination.accountLabel(), debit.getStatus(), source.getBalance(), debit.getCreatedAt(), message);
    }

    private Destination resolveDestination(Long userId, Account from, TransferRequest request) {
        switch (request.mode()) {
            case UPI -> {
                Account target = resolveUpi(request.upiId());
                if (target.getId().equals(from.getId())) throw ApiException.badRequest("You can't pay your own UPI ID from the same account.");
                boolean self = target.getUser().getId().equals(userId);
                return new Destination(target, target.getUser().getFullName(), target.getUpiId(), null, self);
            }
            case INTERNAL -> {
                if (request.toAccountId() != null) {
                    Account target = accountRepository.findById(request.toAccountId())
                            .filter(a -> a.getUser().getId().equals(userId))
                            .orElseThrow(() -> ApiException.notFound("Destination account not found"));
                    if (target.getId().equals(from.getId())) throw ApiException.badRequest("Choose two different accounts.");
                    return new Destination(target, "Own account " + target.getAccountType().name().charAt(0)
                            + target.getAccountType().name().substring(1).toLowerCase(Locale.ROOT) + " ••" + LedgerService.last4(target),
                            target.getAccountNumber(), null, true);
                }
                Beneficiary payee = requirePayee(userId, request.beneficiaryId());
                Account target = internalAccountFor(payee)
                        .orElseThrow(() -> ApiException.badRequest("This payee banks elsewhere. Use IMPS, NEFT or RTGS."));
                return new Destination(target, payee.getName(), payee.getAccountNumber(), payee, false);
            }
            default -> {
                Beneficiary payee = requirePayee(userId, request.beneficiaryId());
                Account target = internalAccountFor(payee).orElse(null);
                return new Destination(target, payee.getName(), payee.getAccountNumber(), payee, false);
            }
        }
    }

    private Beneficiary requirePayee(Long userId, Long beneficiaryId) {
        if (beneficiaryId == null) throw ApiException.badRequest("Choose a payee.");
        return beneficiaryRepository.findByIdAndUserId(beneficiaryId, userId)
                .orElseThrow(() -> ApiException.notFound("Payee not found"));
    }

    Optional<Account> internalAccountFor(Beneficiary payee) {
        if (!BankConstants.isOwnBankIfsc(payee.getIfscCode())) return Optional.empty();
        return accountRepository.findByAccountNumber(payee.getAccountNumber());
    }

    private void checkLimits(Long userId, TransferMode mode, BigDecimal amount, Destination destination) {
        switch (mode) {
            case IMPS -> {
                if (amount.compareTo(settings.amount(Key.IMPS_MAX_PER_TXN)) > 0)
                    throw ApiException.badRequest("IMPS transfers are limited to ₹" + plain(settings.amount(Key.IMPS_MAX_PER_TXN)) + " per transaction. Use NEFT or RTGS for larger amounts.");
            }
            case RTGS -> {
                if (amount.compareTo(settings.amount(Key.RTGS_MIN_AMOUNT)) < 0)
                    throw ApiException.badRequest("RTGS is for ₹" + plain(settings.amount(Key.RTGS_MIN_AMOUNT)) + " and above. Use IMPS or NEFT for smaller amounts.");
            }
            case UPI -> {
                if (amount.compareTo(settings.amount(Key.UPI_MAX_PER_TXN)) > 0)
                    throw ApiException.badRequest("UPI payments are limited to ₹" + plain(settings.amount(Key.UPI_MAX_PER_TXN)) + " per transaction.");
            }
            default -> {
            }
        }

        Beneficiary payee = destination.payee();
        if (payee != null) {
            if (amount.compareTo(payee.getTransferLimit()) > 0)
                throw ApiException.badRequest("This is above the ₹" + plain(payee.getTransferLimit()) + " limit you set for " + payee.getName() + ".");
            BigDecimal coolingCap = settings.amount(Key.NEW_PAYEE_LIMIT);
            if (DtoMapper.isCooling(payee) && amount.compareTo(coolingCap) > 0)
                throw ApiException.badRequest("For your safety, new payees can receive at most ₹" + plain(coolingCap) + " per transfer in their first 24 hours.");
        }

        if (destination.self()) return; // Moving money between your own accounts isn't limited.

        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        BigDecimal dailyLimit = settings.amount(Key.DAILY_TRANSFER_LIMIT);
        BigDecimal usedToday = transactionRepository.sumOutgoing(userId, LIMITED_CHANNELS, startOfDay);
        if (usedToday.add(amount).compareTo(dailyLimit) > 0)
            throw ApiException.badRequest("This exceeds your daily transfer limit. You can send ₹" + plain(dailyLimit.subtract(usedToday).max(BigDecimal.ZERO)) + " more today.");

        if (mode == TransferMode.UPI) {
            BigDecimal upiLimit = settings.amount(Key.UPI_DAILY_LIMIT);
            BigDecimal upiUsed = transactionRepository.sumOutgoing(userId, EnumSet.of(Transaction.Channel.UPI), startOfDay);
            if (upiUsed.add(amount).compareTo(upiLimit) > 0)
                throw ApiException.badRequest("This exceeds your daily UPI limit. You can pay ₹" + plain(upiLimit.subtract(upiUsed).max(BigDecimal.ZERO)) + " more by UPI today.");
        }
    }

    private static String plain(BigDecimal value) {
        return String.format(Locale.forLanguageTag("en-IN"), "%,.0f", value);
    }

    // ---------- Payees ----------

    @Transactional(readOnly = true)
    public List<BeneficiaryDto> payees(Long userId) {
        return beneficiaryRepository.findByUserIdOrderByNameAsc(userId).stream()
                .map(payee -> mapper.beneficiary(payee, internalAccountFor(payee).isPresent()))
                .toList();
    }

    @Transactional
    public BeneficiaryDto addPayee(Long userId, BeneficiaryRequest request) {
        User user = authService.loadUser(userId);
        String accountNumber = request.accountNumber().trim();
        String ifsc = request.ifscCode().trim().toUpperCase(Locale.ROOT);
        if (beneficiaryRepository.existsByUserIdAndAccountNumber(userId, accountNumber)) {
            throw ApiException.conflict("You've already added this account as a payee.");
        }
        if (BankConstants.isOwnBankIfsc(ifsc)) {
            Account internal = accountRepository.findByAccountNumber(accountNumber)
                    .orElseThrow(() -> ApiException.badRequest("No " + BankConstants.BANK_NAME + " account exists with this number."));
            if (internal.getUser().getId().equals(userId)) {
                throw ApiException.badRequest("This is your own account. Use \"Own accounts\" on the transfer page instead.");
            }
        }

        Beneficiary payee = new Beneficiary();
        payee.setUser(user);
        payee.setName(request.name().trim());
        payee.setNickname(request.nickname() == null || request.nickname().isBlank() ? null : request.nickname().trim());
        payee.setAccountNumber(accountNumber);
        payee.setIfscCode(ifsc);
        payee.setBankName(BankConstants.bankNameForIfsc(ifsc));
        payee.setTransferLimit(request.transferLimit().setScale(2, java.math.RoundingMode.DOWN));
        beneficiaryRepository.save(payee);

        notifications.notify(user, Notification.Category.SECURITY, "New payee added",
                payee.getName() + " (" + payee.getBankName() + ", account ending "
                        + accountNumber.substring(accountNumber.length() - 4)
                        + ") was added. Transfers to new payees are capped for the first 24 hours. If you didn't do this, call us immediately.");
        return mapper.beneficiary(payee, internalAccountFor(payee).isPresent());
    }

    @Transactional
    public void removePayee(Long userId, Long payeeId) {
        Beneficiary payee = beneficiaryRepository.findByIdAndUserId(payeeId, userId)
                .orElseThrow(() -> ApiException.notFound("Payee not found"));
        beneficiaryRepository.delete(payee);
    }
}
