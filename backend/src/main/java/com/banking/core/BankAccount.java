package com.banking.core;

import com.banking.exception.BankingException;
import com.banking.exception.InsufficientFundsException;
import com.banking.model.Account;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * Plain-Java account model used by the JDBC layer and the servlet portal. Subclasses decide how the
 * product behaves (interest, name, features); this class owns the balance and keeps it thread-safe.
 *
 * <p>Every balance read and write is {@code synchronized} on the account, and {@link #transferTo}
 * locks both accounts in account-number order, so two opposite transfers can't deadlock.
 */
public abstract class BankAccount implements InterestBearing, Comparable<BankAccount> {

    private final long id;
    private final long userId;
    private final String accountNumber;
    private final Account.AccountStatus status;
    private final BigDecimal interestRate;
    private BigDecimal balance;

    protected BankAccount(long id, long userId, String accountNumber, BigDecimal balance,
                          Account.AccountStatus status, BigDecimal interestRate) {
        this.id = id;
        this.userId = userId;
        this.accountNumber = Objects.requireNonNull(accountNumber);
        this.balance = balance.setScale(2, RoundingMode.HALF_UP);
        this.status = Objects.requireNonNull(status);
        this.interestRate = interestRate == null ? BigDecimal.ZERO : interestRate;
    }

    /** Builds the right subclass for a stored account type (factory method). */
    public static BankAccount of(Account.AccountType type, long id, long userId, String accountNumber,
                                 BigDecimal balance, Account.AccountStatus status, BigDecimal interestRate) {
        return switch (type) {
            case SAVINGS -> new SavingsAccount(id, userId, accountNumber, balance, status, interestRate);
            case SALARY -> new SalaryAccount(id, userId, accountNumber, balance, status, interestRate);
            case CURRENT -> new CurrentAccount(id, userId, accountNumber, balance, status);
        };
    }

    public abstract Account.AccountType type();

    /** Name shown to customers, e.g. "Savings Account". */
    public abstract String productName();

    /** One-line summary of what makes this product different. */
    public abstract String features();

    public synchronized BigDecimal getBalance() {
        return balance;
    }

    public synchronized void deposit(BigDecimal amount) throws BankingException {
        BigDecimal value = validAmount(amount);
        if (status == Account.AccountStatus.CLOSED) {
            throw new BankingException("Account ending " + last4() + " is closed.");
        }
        balance = balance.add(value);
    }

    public synchronized void withdraw(BigDecimal amount) throws BankingException {
        BigDecimal value = validAmount(amount);
        requireCanDebit();
        if (balance.compareTo(value) < 0) {
            throw new InsufficientFundsException(accountNumber, balance, value);
        }
        balance = balance.subtract(value);
    }

    /** Moves money atomically: either both balances change or neither does. */
    public void transferTo(BankAccount target, BigDecimal amount) throws BankingException {
        if (target == this) throw new BankingException("Choose a different account to transfer to.");
        BankAccount first = compareTo(target) <= 0 ? this : target;
        BankAccount second = first == this ? target : this;
        synchronized (first) {
            synchronized (second) {
                if (target.status == Account.AccountStatus.CLOSED) {
                    throw new BankingException("The destination account is closed.");
                }
                withdraw(amount);
                target.deposit(amount);
            }
        }
    }

    protected void requireCanDebit() throws BankingException {
        switch (status) {
            case FROZEN -> throw new BankingException("Account ending " + last4() + " is frozen. Please contact your branch.");
            case CLOSED -> throw new BankingException("Account ending " + last4() + " is closed.");
            default -> {
            }
        }
    }

    private static BigDecimal validAmount(BigDecimal amount) throws BankingException {
        if (amount == null || amount.signum() <= 0) throw new BankingException("Amount must be greater than zero.");
        if (amount.stripTrailingZeros().scale() > 2) throw new BankingException("Amount can have at most 2 decimal places.");
        return amount.setScale(2, RoundingMode.UNNECESSARY);
    }

    public String last4() {
        return accountNumber.substring(Math.max(0, accountNumber.length() - 4));
    }

    public long getId() {
        return id;
    }

    public long getUserId() {
        return userId;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public Account.AccountStatus getStatus() {
        return status;
    }

    public BigDecimal getInterestRate() {
        return interestRate;
    }

    /** Natural order is by account number; it is also the lock order used by {@link #transferTo}. */
    @Override
    public int compareTo(BankAccount other) {
        return accountNumber.compareTo(other.accountNumber);
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof BankAccount other && accountNumber.equals(other.accountNumber);
    }

    @Override
    public int hashCode() {
        return accountNumber.hashCode();
    }

    @Override
    public String toString() {
        return productName() + " ending " + last4() + " (balance " + getBalance() + ")";
    }
}
