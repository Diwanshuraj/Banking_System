package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 11-digit CIF number, usable as a login ID. */
    @Column(nullable = false, unique = true, length = 11)
    private String customerId;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    /** BCrypt hash of the 6-digit transaction PIN; null until the customer sets one. */
    private String transactionPinHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.ROLE_CUSTOMER;

    @Column(length = 20)
    private String phone;

    @Column(length = 10)
    private String panNumber;

    @Column(length = 12)
    private String aadhaarNumber;

    private LocalDate dateOfBirth;

    @Column(length = 255)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(nullable = false)
    private int failedLoginAttempts = 0;

    private LocalDateTime lastLoginAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public boolean isSeniorCitizen() {
        return dateOfBirth != null && !dateOfBirth.plusYears(60).isAfter(LocalDate.now());
    }

    public enum Role {
        ROLE_ADMIN, ROLE_CUSTOMER
    }

    public enum UserStatus {
        ACTIVE, SUSPENDED, LOCKED
    }
}
