package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** A loan application and, once approved, the running loan with its EMI schedule. */
@Entity
@Table(name = "loans")
@Getter
@Setter
@NoArgsConstructor
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String loanNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LoanType type;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal principal;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal interestRate;

    @Column(nullable = false)
    private int tenureMonths;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal emi;

    /** Principal still owed. */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal outstanding = BigDecimal.ZERO;

    @Column(nullable = false)
    private int emisPaid = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LoanStatus status = LoanStatus.PENDING;

    @Column(nullable = false, length = 255)
    private String purpose;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal monthlyIncome;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "disbursement_account_id", nullable = false)
    private Account disbursementAccount;

    @Column(nullable = false)
    private LocalDateTime appliedAt;

    private LocalDateTime decidedAt;

    private LocalDate nextDueDate;

    @Column(length = 255)
    private String remarks;

    @PrePersist
    void onCreate() {
        if (appliedAt == null) appliedAt = LocalDateTime.now();
    }

    public enum LoanType {
        HOME, PERSONAL, CAR, EDUCATION, GOLD
    }

    public enum LoanStatus {
        PENDING, REJECTED, ACTIVE, CLOSED
    }
}
