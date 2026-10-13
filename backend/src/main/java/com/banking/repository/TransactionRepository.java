package com.banking.repository;

import com.banking.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/** Spring Data JPA repository for {@link com.banking.model.Transaction}. */
public interface TransactionRepository extends JpaRepository<Transaction, Long>, JpaSpecificationExecutor<Transaction> {

    /** Money a customer has sent to other people since {@code since}, for daily limits. */
    @Query("""
            select coalesce(sum(t.amount), 0) from Transaction t
            where t.account.user.id = :userId
              and t.direction = com.banking.model.Transaction.Direction.DEBIT
              and t.channel in :channels
              and t.selfTransfer = false
              and t.status = com.banking.model.Transaction.TxnStatus.SUCCESS
              and t.createdAt >= :since
            """)
    BigDecimal sumOutgoing(@Param("userId") Long userId,
                           @Param("channels") Collection<Transaction.Channel> channels,
                           @Param("since") LocalDateTime since);

    boolean existsByReferenceId(String referenceId);

    List<Transaction> findByAccountIdInAndCreatedAtGreaterThanEqual(Collection<Long> accountIds, LocalDateTime since);

    List<Transaction> findTop5ByAccountIdInOrderByCreatedAtDescIdDesc(Collection<Long> accountIds);

    List<Transaction> findByDirectionAndCreatedAtGreaterThanEqual(Transaction.Direction direction, LocalDateTime since);

    List<Transaction> findByAccountIdAndCreatedAtBetweenOrderByCreatedAtAscIdAsc(Long accountId, LocalDateTime from, LocalDateTime to);
}
