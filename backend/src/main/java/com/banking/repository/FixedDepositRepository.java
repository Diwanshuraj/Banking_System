package com.banking.repository;

import com.banking.model.FixedDeposit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Spring Data JPA repository for {@link com.banking.model.FixedDeposit}. */
public interface FixedDepositRepository extends JpaRepository<FixedDeposit, Long> {

    List<FixedDeposit> findByUserIdOrderByStartDateDesc(Long userId);

    Optional<FixedDeposit> findByIdAndUserId(Long id, Long userId);

    List<FixedDeposit> findByStatusAndMaturityDateLessThanEqual(FixedDeposit.FdStatus status, LocalDate date);

    boolean existsByFdNumber(String fdNumber);
}
