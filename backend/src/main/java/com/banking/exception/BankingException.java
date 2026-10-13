package com.banking.exception;

/**
 * Base checked exception for the core banking model and the JDBC layer. Unlike {@link ApiException}
 * (unchecked, for the REST API), callers are forced by the compiler to handle these.
 */
public class BankingException extends Exception {

    public BankingException(String message) {
        super(message);
    }

    public BankingException(String message, Throwable cause) {
        super(message, cause);
    }
}
