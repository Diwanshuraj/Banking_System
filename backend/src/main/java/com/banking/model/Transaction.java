package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * One ledger entry on one account (a passbook line). A transfer between two accounts of this bank
 * produces two entries, a DEBIT and a CREDIT, sharing the same reference ID.
 */
@Entity
@Table(name = "transactions", indexes = {
        @Index(name = "idx_txn_account_created", columnList = "account_id, created_at"),
        @Index(name = "idx_txn_reference", columnList = "reference_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reference_id", nullable = false, length = 40)
    private String referenceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Direction direction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Channel channel;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal balanceAfter;

    @Column(length = 100)
    private String counterpartyName;

    @Column(length = 60)
    private String counterpartyAccount;

    @Column(nullable = false, length = 255)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TxnStatus status = TxnStatus.SUCCESS;

    /** Transfers between the customer's own accounts don't count towards daily limits. */
    @Column(nullable = false)
    private boolean selfTransfer = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public enum Direction {
        CREDIT, DEBIT
    }

    public enum Channel {
        UPI, IMPS, NEFT, RTGS, INTERNAL, BILL_PAYMENT, FIXED_DEPOSIT, LOAN, INTEREST, CASH
    }

    public enum TxnStatus {
        SUCCESS, PENDING, FAILED
    }
}
