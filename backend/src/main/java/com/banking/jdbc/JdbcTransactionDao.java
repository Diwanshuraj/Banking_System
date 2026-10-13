package com.banking.jdbc;

import com.banking.exception.DatabaseException;
import com.banking.model.Transaction;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** JDBC implementation of {@link TransactionDao}; every query is a {@code PreparedStatement}. */
@Repository
public class JdbcTransactionDao implements TransactionDao {

    private static final String COLUMNS = "SELECT id, account_id, reference_id, direction, channel, amount, balance_after, "
            + "counterparty_name, description, created_at FROM transactions ";

    private final DBConnection db;

    public JdbcTransactionDao(DBConnection db) {
        this.db = db;
    }

    @Override
    public Optional<TransactionRecord> findById(Long id) throws DatabaseException {
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(COLUMNS + "WHERE id = ?")) {
            ps.setLong(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseException("Could not load the transaction", e);
        }
    }

    @Override
    public List<TransactionRecord> findRecent(long accountId, int limit) throws DatabaseException {
        String sql = COLUMNS + "WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT ?";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, accountId);
            ps.setInt(2, limit);
            try (ResultSet rs = ps.executeQuery()) {
                List<TransactionRecord> records = new ArrayList<>();
                while (rs.next()) records.add(map(rs));
                return records;
            }
        } catch (SQLException e) {
            throw new DatabaseException("Could not load transactions", e);
        }
    }

    @Override
    public Map<Transaction.Direction, Map<Transaction.Channel, BigDecimal>> totalsByChannel(long accountId, LocalDateTime from)
            throws DatabaseException {
        String sql = "SELECT direction, channel, SUM(amount) AS total FROM transactions "
                + "WHERE account_id = ? AND created_at >= ? AND status = 'SUCCESS' GROUP BY direction, channel";
        Map<Transaction.Direction, Map<Transaction.Channel, BigDecimal>> totals = new EnumMap<>(Transaction.Direction.class);
        for (Transaction.Direction direction : Transaction.Direction.values()) {
            totals.put(direction, new EnumMap<>(Transaction.Channel.class));
        }
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, accountId);
            ps.setTimestamp(2, Timestamp.valueOf(from));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    totals.get(Transaction.Direction.valueOf(rs.getString("direction")))
                            .put(Transaction.Channel.valueOf(rs.getString("channel")), rs.getBigDecimal("total"));
                }
            }
            return totals;
        } catch (SQLException e) {
            throw new DatabaseException("Could not total transactions", e);
        }
    }

    private static TransactionRecord map(ResultSet rs) throws SQLException {
        return new TransactionRecord(
                rs.getLong("id"),
                rs.getLong("account_id"),
                rs.getString("reference_id"),
                Transaction.Direction.valueOf(rs.getString("direction")),
                Transaction.Channel.valueOf(rs.getString("channel")),
                rs.getBigDecimal("amount"),
                rs.getBigDecimal("balance_after"),
                rs.getString("counterparty_name"),
                rs.getString("description"),
                rs.getTimestamp("created_at").toLocalDateTime());
    }
}
