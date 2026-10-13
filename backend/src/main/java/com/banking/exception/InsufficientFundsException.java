package com.banking.exception;

import java.math.BigDecimal;

/** A withdrawal or transfer asked for more than the account holds. */
public class InsufficientFundsException extends BankingException {

    private final BigDecimal available;
    private final BigDecimal requested;

    public InsufficientFundsException(String accountNumber, BigDecimal available, BigDecimal requested) {
        super("Insufficient balance in account ending " + accountNumber.substring(Math.max(0, accountNumber.length() - 4))
                + ": available " + available + ", requested " + requested + ".");
        this.available = available;
        this.requested = requested;
    }

    public BigDecimal getAvailable() {
        return available;
    }

    public BigDecimal getRequested() {
        return requested;
    }
}
