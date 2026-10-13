package com.banking.jdbc;

import com.banking.exception.DatabaseException;

import java.util.Optional;

/**
 * Operations every DAO supports, parameterised by the entity type and its key type.
 *
 * @param <T>  the type the DAO reads and writes
 * @param <ID> the type of its primary key
 */
public interface GenericDao<T, ID> {

    Optional<T> findById(ID id) throws DatabaseException;
}
