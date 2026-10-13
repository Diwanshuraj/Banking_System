package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** A customer service request, such as a cheque book or an address change, and its progress. */
@Entity
@Table(name = "service_requests")
@Getter
@Setter
@NoArgsConstructor
public class ServiceRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String ticketNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private RequestType type;

    @Column(nullable = false, length = 500)
    private String details;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus status = RequestStatus.OPEN;

    @Column(length = 255)
    private String remarks;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum RequestType {
        CHEQUE_BOOK, STOP_CHEQUE, DEBIT_CARD_REISSUE, ADDRESS_CHANGE, NOMINEE_UPDATE, KYC_UPDATE, ACCOUNT_CLOSURE
    }

    public enum RequestStatus {
        OPEN, IN_PROGRESS, COMPLETED, REJECTED
    }
}
