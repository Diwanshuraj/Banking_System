package com.banking.exception;

/** No account with this id exists, or it belongs to another customer. */
public class AccountNotFoundException extends BankingException {

    public AccountNotFoundException(long accountId) {
        super("Account " + accountId + " was not found.");
    }
}
