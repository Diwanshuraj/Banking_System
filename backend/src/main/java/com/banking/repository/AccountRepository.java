package com.banking.repository;

import com.banking.model.Account;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {

    List<Account> findByUserIdOrderByOpenedAtAsc(Long userId);

    Optional<Account> findByAccountNumber(String accountNumber);

    Optional<Account> findByUpiIdIgnoreCase(String upiId);

    boolean existsByAccountNumber(String accountNumber);

    boolean existsByUpiId(String upiId);

    long countByStatus(Account.AccountStatus status);

    List<Account> findByAccountTypeInAndStatus(Collection<Account.AccountType> types, Account.AccountStatus status);

    /** Row lock for balance updates; always lock in ascending id order to avoid deadlocks. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a where a.id = :id")
    Optional<Account> findByIdForUpdate(@Param("id") Long id);

    @Query("select coalesce(sum(a.balance), 0) from Account a where a.status <> :excluded")
    BigDecimal totalBalanceExcluding(@Param("excluded") Account.AccountStatus excluded);

    @Query("select a from Account a join fetch a.user order by a.openedAt desc")
    List<Account> findAllWithUser();

    @Query("""
            select a from Account a join fetch a.user u
            where a.accountNumber like concat('%', :q, '%')
               or lower(u.fullName) like lower(concat('%', :q, '%'))
               or lower(a.upiId) like lower(concat('%', :q, '%'))
            order by a.openedAt desc
            """)
    List<Account> searchWithUser(@Param("q") String q);
}
