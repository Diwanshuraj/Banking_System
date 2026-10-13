package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A saved payee that the customer can send money to, with an optional per-transfer limit. */
@Entity
@Table(name = "beneficiaries", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "account_number"}))
@Getter
@Setter
@NoArgsConstructor
public class Beneficiary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 50)
    private String nickname;

    @Column(name = "account_number", nullable = false, length = 20)
    private String accountNumber;

    @Column(nullable = false, length = 11)
    private String ifscCode;

    @Column(nullable = false, length = 100)
    private String bankName;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal transferLimit;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
