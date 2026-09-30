-- =============================================================================
-- INDIAN ONLINE BANKING SYSTEM - MYSQL DATABASE SCHEMA & SEED DATA
-- Database Name: banking_db
-- Bank Name: Imperial Bank of India / Bharat National Bank
-- =============================================================================

CREATE DATABASE IF NOT EXISTS banking_db;
USE banking_db;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('ROLE_ADMIN', 'ROLE_CUSTOMER') NOT NULL DEFAULT 'ROLE_CUSTOMER',
    phone VARCHAR(20),
    pan_number VARCHAR(10),
    aadhaar_number VARCHAR(12),
    status ENUM('ACTIVE', 'SUSPENDED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS accounts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    account_number VARCHAR(20) NOT NULL UNIQUE,
    ifsc_code VARCHAR(11) NOT NULL DEFAULT 'SBIN0001042',
    account_type ENUM('SAVINGS', 'CURRENT', 'FIXED_DEPOSIT') NOT NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status ENUM('ACTIVE', 'FROZEN', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    reference_id VARCHAR(50) NOT NULL UNIQUE,
    sender_account_id BIGINT,
    receiver_account_id BIGINT,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type ENUM('UPI', 'NEFT', 'RTGS', 'IMPS', 'BILL_PAYMENT') NOT NULL,
    status ENUM('SUCCESS', 'PENDING', 'FAILED') NOT NULL DEFAULT 'SUCCESS',
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_account_id) REFERENCES accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (receiver_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- 4. BANKING SERVICES TABLE
CREATE TABLE IF NOT EXISTS banking_services (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    service_type ENUM('LOAN', 'CREDIT_CARD', 'INVESTMENT', 'INSURANCE') NOT NULL,
    interest_rate DECIMAL(5, 2) DEFAULT 0.00,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- 5. SERVICE APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS service_applications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    requested_amount DECIMAL(15, 2),
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    notes VARCHAR(255),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES banking_services(id) ON DELETE CASCADE
);

-- 6. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS system_settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================================================
-- INITIAL SEED DATA (INDIAN BANKING SYSTEM)
-- =============================================================================

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('DAILY_UPI_LIMIT', '100000.00', 'Maximum transfer limit per day via UPI in INR'),
('MAINTENANCE_MODE', 'false', 'Flag to enable system-wide maintenance mode'),
('DEFAULT_SAVINGS_INTEREST_RATE', '6.50', 'Annual yield percentage for savings accounts'),
('MAX_LOGIN_ATTEMPTS', '5', 'Account lock threshold for failed password attempts')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

INSERT INTO banking_services (service_name, service_type, interest_rate, description, is_active) VALUES
('SBI Flexi Home Loan', 'LOAN', 8.40, 'Low-interest personal and home loans up to ₹50,00,000.', TRUE),
('HDFC Regalia Gold Credit Card', 'CREDIT_CARD', 14.99, 'Zero annual fee card with complimentary lounge access & 4X reward points.', TRUE),
('Tax Saver Fixed Deposit (5 Year)', 'INVESTMENT', 7.25, 'Guaranteed FD return with Section 80C tax deduction benefits.', TRUE),
('LIC Jeevan Umang Insurance', 'INSURANCE', 0.00, 'Whole life assurance policy with annual survival benefits.', TRUE)
ON DUPLICATE KEY UPDATE service_name = VALUES(service_name);

INSERT INTO users (id, full_name, email, password_hash, role, phone, pan_number, aadhaar_number, status) VALUES
(1, 'Rajesh Sharma', 'admin@bank.com', '$2a$10$e8N3vH8K.P0k1q2w3e4r5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0', 'ROLE_ADMIN', '+91 98765-43210', 'ABCDE1234F', '123456789012', 'ACTIVE'),
(2, 'Priya Verma', 'priya.v@example.com', '$2a$10$e8N3vH8K.P0k1q2w3e4r5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0', 'ROLE_CUSTOMER', '+91 98123-45678', 'BKZPV9876Q', '987654321098', 'ACTIVE'),
(3, 'Amit Patel', 'amit.p@example.com', '$2a$10$e8N3vH8K.P0k1q2w3e4r5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0', 'ROLE_CUSTOMER', '+91 97654-32109', 'CLMAP4321R', '456789012345', 'ACTIVE')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

INSERT INTO accounts (id, user_id, account_number, ifsc_code, account_type, balance, currency, status) VALUES
(101, 2, 'SBIN0001042881', 'SBIN0001042', 'SAVINGS', 248500.75, 'INR', 'ACTIVE'),
(102, 2, 'SBIN0001042882', 'SBIN0001042', 'CURRENT', 34200.00, 'INR', 'ACTIVE'),
(103, 3, 'HDFC0000128773', 'HDFC0000128', 'SAVINGS', 123000.50, 'INR', 'ACTIVE')
ON DUPLICATE KEY UPDATE balance = VALUES(balance);

INSERT INTO transactions (reference_id, sender_account_id, receiver_account_id, amount, transaction_type, status, description) VALUES
('UPI/426810293812', 101, 102, 5000.00, 'UPI', 'SUCCESS', 'UPI Transfer to Priya'),
('NEFT/N28391028471', 103, 101, 12500.00, 'NEFT', 'SUCCESS', 'Salary Credit NEFT'),
('IMPS/981203948102', 102, NULL, 850.50, 'IMPS', 'SUCCESS', 'Electricity Bill Payment via Electricity Board')
ON DUPLICATE KEY UPDATE status = VALUES(status);
