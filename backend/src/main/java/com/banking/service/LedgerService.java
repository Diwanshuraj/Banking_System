package com.banking.service;

import com.banking.exception.ApiException;
import com.banking.model.Account;
import com.banking.model.Transaction;
import com.banking.repository.AccountRepository;
import com.banking.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The only place balances change. Callers must already be inside a transaction; accounts are
 * row-locked (in id order) before being read so concurrent transfers can't overdraw them.
 */
@Service
@RequiredArgsConstructor
public class LedgerService {

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    /** Locks the given accounts in ascending id order and returns them keyed by id. */
    public Map<Long, Account> lock(Long... accountIds) {
        Map<Long, Account> locked = new LinkedHashMap<>();
        List.of(accountIds).stream().distinct().sorted(Comparator.naturalOrder()).forEach(id ->
                locked.put(id, accountRepository.findByIdForUpdate(id)
                        .orElseThrow(() -> ApiException.notFound("Account not found"))));
        return locked;
    }

    public Account lockOne(Long accountId) {
        return lock(accountId).get(accountId);
    }

    public record Entry(Transaction.Channel channel, String referenceId, String counterpartyName,
                        String counterpartyAccount, String description, boolean selfTransfer) {
    }

    /** Debits a locked account. Fails if the account can't send money or lacks funds. */
    public Transaction debit(Account account, BigDecimal amount, Entry entry) {
        requireCanDebit(account);
        BigDecimal value = normalize(amount);
        if (account.getBalance().compareTo(value) < 0) {
            throw ApiException.badRequest("Insufficient balance in account ending " + last4(account) + ".");
        }
        account.setBalance(account.getBalance().subtract(value));
        return record(account, Transaction.Direction.DEBIT, value, entry);
    }

    /** Credits a locked account. Credits to frozen accounts are allowed (salary etc. still arrives). */
    public Transaction credit(Account account, BigDecimal amount, Entry entry) {
        if (account.getStatus() == Account.AccountStatus.CLOSED) {
            throw ApiException.badRequest("The destination account is closed.");
        }
        BigDecimal value = normalize(amount);
        account.setBalance(account.getBalance().add(value));
        return record(account, Transaction.Direction.CREDIT, value, entry);
    }

    public static void requireCanDebit(Account account) {
        switch (account.getStatus()) {
            case FROZEN -> throw ApiException.forbidden("Account ending " + last4(account)
                    + " is frozen. Please contact your branch.");
            case CLOSED -> throw ApiException.badRequest("Account ending " + last4(account) + " is closed.");
            default -> {
            }
        }
    }

    public static BigDecimal normalize(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) throw ApiException.badRequest("Amount must be greater than zero.");
        if (amount.stripTrailingZeros().scale() > 2) throw ApiException.badRequest("Amount can have at most 2 decimal places.");
        return amount.setScale(2, RoundingMode.UNNECESSARY);
    }

    public static String last4(Account account) {
        String number = account.getAccountNumber();
        return number.substring(Math.max(0, number.length() - 4));
    }

    private Transaction record(Account account, Transaction.Direction direction, BigDecimal amount, Entry entry) {
        Transaction txn = new Transaction();
        txn.setAccount(account);
        txn.setDirection(direction);
        txn.setChannel(entry.channel());
        txn.setAmount(amount);
        txn.setBalanceAfter(account.getBalance());
        txn.setReferenceId(entry.referenceId());
        txn.setCounterpartyName(entry.counterpartyName());
        txn.setCounterpartyAccount(entry.counterpartyAccount());
        txn.setDescription(entry.description());
        txn.setSelfTransfer(entry.selfTransfer());
        txn.setStatus(Transaction.TxnStatus.SUCCESS);
        return transactionRepository.save(txn);
    }
}
