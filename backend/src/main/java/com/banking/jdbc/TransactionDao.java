package com.banking.jdbc;

import com.banking.exception.DatabaseException;
import com.banking.model.Transaction;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Reads passbook entries and per-channel totals with JDBC. */
public interface TransactionDao extends GenericDao<TransactionRecord, Long> {

    /** The latest {@code limit} entries on an account, newest first. */
    List<TransactionRecord> findRecent(long accountId, int limit) throws DatabaseException;

    /** Total money moved per channel and direction since {@code from} (a SQL GROUP BY). */
    Map<Transaction.Direction, Map<Transaction.Channel, BigDecimal>> totalsByChannel(long accountId, LocalDateTime from)
            throws DatabaseException;
}
