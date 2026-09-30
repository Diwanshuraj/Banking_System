package com.banking.repository;

import com.banking.model.DebitCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DebitCardRepository extends JpaRepository<DebitCard, Long> {

    List<DebitCard> findByAccountUserIdOrderByIdAsc(Long userId);

    Optional<DebitCard> findByIdAndAccountUserId(Long id, Long userId);
}
