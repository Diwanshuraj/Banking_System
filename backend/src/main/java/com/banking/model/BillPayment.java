package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A bill payment or recharge paid from one of the customer's accounts. */
@Entity
@Table(name = "bill_payments")
@Getter
@Setter
@NoArgsConstructor
public class BillPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 40)
    private String referenceId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BillCategory category;

    @Column(nullable = false, length = 100)
    private String billerName;

    @Column(nullable = false, length = 40)
    private String consumerNumber;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Transaction.TxnStatus status = Transaction.TxnStatus.SUCCESS;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public enum BillCategory {
        ELECTRICITY, MOBILE, DTH, WATER, GAS, BROADBAND, FASTAG, INSURANCE, CREDIT_CARD
    }
}
