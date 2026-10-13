package com.banking.jdbc;

import com.banking.exception.DatabaseException;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

/**
 * Single entry point for raw JDBC connections. It hands out connections from the application's
 * pooled {@link DataSource} (MySQL by default, H2 in the dev profile), so the DAOs use the same
 * database as the rest of the app. Callers must close each connection, ideally with try-with-resources.
 */
@Component
public class DBConnection {

    private final DataSource dataSource;

    public DBConnection(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public Connection getConnection() throws DatabaseException {
        try {
            return dataSource.getConnection();
        } catch (SQLException e) {
            throw new DatabaseException("Could not connect to the database", e);
        }
    }
}
