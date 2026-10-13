package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** A fixed deposit funded from one of the customer's accounts. */
@Entity
@Table(name = "fixed_deposits")
@Getter
@Setter
@NoArgsConstructor
public class FixedDeposit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String fdNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Funds come from, and are paid back to, this account. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_account_id", nullable = false)
    private Account sourceAccount;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal principal;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal interestRate;

    @Column(nullable = false)
    private int tenureMonths;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate maturityDate;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal maturityAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private FdStatus status = FdStatus.ACTIVE;

    @Column(nullable = false)
    private boolean autoRenew;

    private LocalDateTime closedAt;

    @Column(precision = 15, scale = 2)
    private BigDecimal payoutAmount;

    public enum FdStatus {
        ACTIVE, MATURED, CLOSED
    }
}
