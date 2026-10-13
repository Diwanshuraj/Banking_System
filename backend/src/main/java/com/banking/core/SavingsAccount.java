package com.banking.core;

import com.banking.model.Account;
import com.banking.service.FinanceMath;

import java.math.BigDecimal;

/** Earns monthly interest on the balance at the account's rate. */
public class SavingsAccount extends BankAccount {

    public SavingsAccount(long id, long userId, String accountNumber, BigDecimal balance,
                          Account.AccountStatus status, BigDecimal interestRate) {
        super(id, userId, accountNumber, balance, status, interestRate);
    }

    @Override
    public Account.AccountType type() {
        return Account.AccountType.SAVINGS;
    }

    @Override
    public String productName() {
        return "Savings Account";
    }

    @Override
    public String features() {
        return "Earns " + getInterestRate().stripTrailingZeros().toPlainString() + "% a year, credited monthly";
    }

    @Override
    public BigDecimal monthlyInterest() {
        return FinanceMath.monthlyInterest(getBalance(), getInterestRate());
    }
}
