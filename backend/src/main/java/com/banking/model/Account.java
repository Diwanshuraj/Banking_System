package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A customer's bank account (Savings, Current or Salary) with its balance, status and UPI handle. */
@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 20)
    private String accountNumber;

    @Column(nullable = false, length = 11)
    private String ifscCode;

    @Column(nullable = false, length = 100)
    private String branchName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountType accountType;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(nullable = false, length = 3)
    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status = AccountStatus.ACTIVE;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal interestRate = BigDecimal.ZERO;

    @Column(length = 100)
    private String nomineeName;

    /** UPI handle linked to this account (only the customer's primary account has one). */
    @Column(unique = true, length = 60)
    private String upiId;

    @Column(nullable = false)
    private LocalDateTime openedAt;

    @PrePersist
    void onCreate() {
        if (openedAt == null) openedAt = LocalDateTime.now();
    }

    public enum AccountType {
        SAVINGS, CURRENT, SALARY
    }

    public enum AccountStatus {
        ACTIVE, FROZEN, CLOSED
    }
}
