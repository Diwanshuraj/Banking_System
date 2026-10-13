package com.banking.jdbc;

import com.banking.core.BankAccount;
import com.banking.exception.DatabaseException;

import java.util.List;
import java.util.Optional;

/** Reads accounts with JDBC and returns them as {@link com.banking.core.BankAccount} objects. */
public interface AccountDao extends GenericDao<BankAccount, Long> {

    /** All of a customer's accounts, oldest first. */
    List<BankAccount> findByUserId(long userId) throws DatabaseException;

    /** The account only if it belongs to this customer; used to stop customers reading others' data. */
    Optional<BankAccount> findByIdForUser(long accountId, long userId) throws DatabaseException;
}
