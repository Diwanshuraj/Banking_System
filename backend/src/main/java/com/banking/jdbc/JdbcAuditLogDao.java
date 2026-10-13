package com.banking.jdbc;

import com.banking.exception.DatabaseException;
import org.springframework.stereotype.Repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/**
 * The audit table isn't a JPA entity: it is created, written and read here with plain JDBC
 * (DDL through {@link Statement}, batched inserts with manual commit and rollback).
 */
@Repository
public class JdbcAuditLogDao implements AuditLogDao {

    private static final String CREATE_TABLE = """
            CREATE TABLE IF NOT EXISTS portal_audit_log (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT NOT NULL,
                action VARCHAR(40) NOT NULL,
                detail VARCHAR(255),
                ip_address VARCHAR(45),
                created_at DATETIME NOT NULL
            )""";

    private final DBConnection db;

    public JdbcAuditLogDao(DBConnection db) {
        this.db = db;
    }

    @Override
    public void createTableIfMissing() throws DatabaseException {
        try (Connection conn = db.getConnection();
             Statement statement = conn.createStatement()) {
            statement.execute(CREATE_TABLE);
        } catch (SQLException e) {
            throw new DatabaseException("Could not create the audit table", e);
        }
    }

    @Override
    public void insertAll(List<AuditEvent> events) throws DatabaseException {
        if (events.isEmpty()) return;
        String sql = "INSERT INTO portal_audit_log (user_id, action, detail, ip_address, created_at) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = db.getConnection()) {
            boolean autoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                for (AuditEvent event : events) {
                    ps.setLong(1, event.userId());
                    ps.setString(2, event.action());
                    ps.setString(3, event.detail());
                    ps.setString(4, event.ipAddress());
                    ps.setTimestamp(5, Timestamp.valueOf(event.createdAt()));
                    ps.addBatch();
                }
                ps.executeBatch();
                conn.commit();
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            } finally {
                conn.setAutoCommit(autoCommit);
            }
        } catch (SQLException e) {
            throw new DatabaseException("Could not save " + events.size() + " audit events", e);
        }
    }

    @Override
    public List<AuditEvent> findRecentByUser(long userId, int limit) throws DatabaseException {
        String sql = "SELECT user_id, action, detail, ip_address, created_at FROM portal_audit_log "
                + "WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                List<AuditEvent> events = new ArrayList<>();
                while (rs.next()) {
                    events.add(new AuditEvent(rs.getLong("user_id"), rs.getString("action"), rs.getString("detail"),
                            rs.getString("ip_address"), rs.getTimestamp("created_at").toLocalDateTime()));
                }
                return events;
            }
        } catch (SQLException e) {
            throw new DatabaseException("Could not load activity", e);
        }
    }
}
