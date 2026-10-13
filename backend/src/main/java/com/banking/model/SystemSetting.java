package com.banking.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One bank-wide setting (a limit, rate or flag) stored as a key/value pair. */
@Entity
@Table(name = "system_settings")
@Getter
@Setter
@NoArgsConstructor
public class SystemSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String settingKey;

    @Column(nullable = false, length = 255)
    private String settingValue;

    @Column(length = 255)
    private String description;
}
