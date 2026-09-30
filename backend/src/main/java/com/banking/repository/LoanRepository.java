package com.banking.repository;

import com.banking.model.Loan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface LoanRepository extends JpaRepository<Loan, Long> {

    List<Loan> findByUserIdOrderByAppliedAtDesc(Long userId);

    Optional<Loan> findByIdAndUserId(Long id, Long userId);

    List<Loan> findByStatusOrderByAppliedAtDesc(Loan.LoanStatus status);

    List<Loan> findAllByOrderByAppliedAtDesc();

    long countByStatus(Loan.LoanStatus status);

    boolean existsByLoanNumber(String loanNumber);

    @Query("select coalesce(sum(l.outstanding), 0) from Loan l where l.status = :status")
    BigDecimal sumOutstanding(@Param("status") Loan.LoanStatus status);
}
