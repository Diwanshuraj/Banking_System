package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/** The debit card linked to an account, with its channel switches and daily limits. */
@Entity
@Table(name = "debit_cards")
@Getter
@Setter
@NoArgsConstructor
public class DebitCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    /** Only the first four and last four digits are stored, never the full card number. */
    @Column(nullable = false, length = 4)
    private String first4;

    @Column(nullable = false, length = 4)
    private String last4;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Network network;

    @Column(nullable = false, length = 30)
    private String variant;

    @Column(nullable = false, length = 5)
    private String expiry;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CardStatus status = CardStatus.ACTIVE;

    private boolean onlineEnabled = true;
    private boolean internationalEnabled = false;
    private boolean contactlessEnabled = true;
    private boolean atmEnabled = true;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal atmLimit;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal posLimit;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal onlineLimit;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal maxLimit;

    public enum Network {
        RUPAY, VISA, MASTERCARD
    }

    public enum CardStatus {
        ACTIVE, BLOCKED, HOTLISTED
    }
}
