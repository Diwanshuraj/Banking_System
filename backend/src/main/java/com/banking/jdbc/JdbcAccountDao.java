package com.banking.jdbc;

import com.banking.core.BankAccount;
import com.banking.exception.DatabaseException;
import com.banking.model.Account;
import org.springframework.stereotype.Repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Reads accounts with plain JDBC and turns each row into the matching {@link BankAccount} subclass. */
@Repository
public class JdbcAccountDao implements AccountDao {

    private static final String COLUMNS =
            "SELECT id, user_id, account_number, account_type, balance, status, interest_rate FROM accounts ";

    private final DBConnection db;

    public JdbcAccountDao(DBConnection db) {
        this.db = db;
    }

    @Override
    public Optional<BankAccount> findById(Long id) throws DatabaseException {
        return queryOne(COLUMNS + "WHERE id = ?", id);
    }

    @Override
    public Optional<BankAccount> findByIdForUser(long accountId, long userId) throws DatabaseException {
        return queryOne(COLUMNS + "WHERE id = ? AND user_id = ?", accountId, userId);
    }

    @Override
    public List<BankAccount> findByUserId(long userId) throws DatabaseException {
        String sql = COLUMNS + "WHERE user_id = ? ORDER BY opened_at";
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                List<BankAccount> accounts = new ArrayList<>();
                while (rs.next()) accounts.add(map(rs));
                return accounts;
            }
        } catch (SQLException e) {
            throw new DatabaseException("Could not load accounts", e);
        }
    }

    private Optional<BankAccount> queryOne(String sql, long... params) throws DatabaseException {
        try (Connection conn = db.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) ps.setLong(i + 1, params[i]);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? Optional.of(map(rs)) : Optional.empty();
            }
        } catch (SQLException e) {
            throw new DatabaseException("Could not load the account", e);
        }
    }

    private static BankAccount map(ResultSet rs) throws SQLException {
        return BankAccount.of(
                Account.AccountType.valueOf(rs.getString("account_type")),
                rs.getLong("id"),
                rs.getLong("user_id"),
                rs.getString("account_number"),
                rs.getBigDecimal("balance"),
                Account.AccountStatus.valueOf(rs.getString("status")),
                rs.getBigDecimal("interest_rate"));
    }
}
