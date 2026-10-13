package com.banking.core;

import com.banking.model.Account;

import java.math.BigDecimal;

/** A savings account that an employer pays salary into; it earns interest the same way. */
public class SalaryAccount extends SavingsAccount {

    public SalaryAccount(long id, long userId, String accountNumber, BigDecimal balance,
                         Account.AccountStatus status, BigDecimal interestRate) {
        super(id, userId, accountNumber, balance, status, interestRate);
    }

    @Override
    public Account.AccountType type() {
        return Account.AccountType.SALARY;
    }

    @Override
    public String productName() {
        return "Salary Account";
    }

    @Override
    public String features() {
        return super.features() + "; zero balance, salary credited by your employer";
    }
}
