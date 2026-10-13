package com.banking.jdbc;

import com.banking.exception.DatabaseException;

import java.util.List;

/** Stores and reads the servlet portal's activity log with JDBC. */
public interface AuditLogDao {

    /** Creates the audit table on first start; safe to call every time. */
    void createTableIfMissing() throws DatabaseException;

    /** Inserts all events in one database transaction: either every row is saved or none is. */
    void insertAll(List<AuditEvent> events) throws DatabaseException;

    List<AuditEvent> findRecentByUser(long userId, int limit) throws DatabaseException;
}
