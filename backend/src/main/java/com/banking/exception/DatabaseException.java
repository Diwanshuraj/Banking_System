package com.banking.exception;

import java.sql.SQLException;

/** Wraps a {@link SQLException} from the JDBC layer so callers deal with one banking exception type. */
public class DatabaseException extends BankingException {

    public DatabaseException(String message, SQLException cause) {
        super(message + " (" + cause.getMessage() + ")", cause);
    }
}
