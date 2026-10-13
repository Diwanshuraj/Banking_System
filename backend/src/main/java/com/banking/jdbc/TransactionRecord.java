package com.banking.jdbc;

import com.banking.model.Transaction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** One passbook line as read by {@link JdbcTransactionDao}. */
public record TransactionRecord(long id, long accountId, String referenceId, Transaction.Direction direction,
                                Transaction.Channel channel, BigDecimal amount, BigDecimal balanceAfter,
                                String counterpartyName, String description, LocalDateTime createdAt) {

    public boolean isCredit() {
        return direction == Transaction.Direction.CREDIT;
    }
}
