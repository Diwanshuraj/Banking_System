package com.banking.core;

import com.banking.model.Account;

import java.math.BigDecimal;

/** Business account for frequent transactions. Current accounts don't earn interest. */
public class CurrentAccount extends BankAccount {

    public CurrentAccount(long id, long userId, String accountNumber, BigDecimal balance, Account.AccountStatus status) {
        super(id, userId, accountNumber, balance, status, BigDecimal.ZERO);
    }

    @Override
    public Account.AccountType type() {
        return Account.AccountType.CURRENT;
    }

    @Override
    public String productName() {
        return "Current Account";
    }

    @Override
    public String features() {
        return "No interest; built for high-volume business transactions";
    }

    @Override
    public BigDecimal monthlyInterest() {
        return BigDecimal.ZERO.setScale(2);
    }
}
