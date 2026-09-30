package com.banking.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class BankingApiController {

    // --- Admin Endpoints ---

    @GetMapping("/admin/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<Map<String, Object>> users = List.of(
            Map.of("id", 1, "fullName", "Rajesh Sharma (Admin)", "email", "admin@bank.com", "role", "ROLE_ADMIN", "status", "ACTIVE", "phone", "+91 98765-43210", "pan", "ABCDE1234F", "aadhaar", "XXXX-XXXX-9012"),
            Map.of("id", 2, "fullName", "Priya Verma", "email", "priya.v@example.com", "role", "ROLE_CUSTOMER", "status", "ACTIVE", "phone", "+91 98123-45678", "pan", "BKZPV9876Q", "aadhaar", "XXXX-XXXX-1098"),
            Map.of("id", 3, "fullName", "Amit Patel", "email", "amit.p@example.com", "role", "ROLE_CUSTOMER", "status", "ACTIVE", "phone", "+91 97654-32109", "pan", "CLMAP4321R", "aadhaar", "XXXX-XXXX-2345")
        );
        return ResponseEntity.ok(users);
    }

    @PostMapping("/admin/users")
    public ResponseEntity<Map<String, String>> createUser(@RequestBody Map<String, Object> userData) {
        return ResponseEntity.ok(Map.of("message", "User created successfully!", "status", "SUCCESS"));
    }

    @DeleteMapping("/admin/users/{id}")
    public ResponseEntity<Map<String, String>> deleteUser(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("message", "User " + id + " deleted successfully!", "status", "SUCCESS"));
    }

    @GetMapping("/admin/transactions")
    public ResponseEntity<List<Map<String, Object>>> getAllTransactions() {
        List<Map<String, Object>> txns = List.of(
            Map.of("id", 1, "referenceId", "UPI/426810293812", "senderAccount", "SBIN0001042881", "receiverAccount", "SBIN0001042882", "amount", 5000.00, "type", "UPI", "status", "SUCCESS", "date", "2026-09-26 14:32"),
            Map.of("id", 2, "referenceId", "NEFT/N28391028471", "senderAccount", "HDFC0000128773", "receiverAccount", "SBIN0001042881", "amount", 12500.00, "type", "NEFT", "status", "SUCCESS", "date", "2026-09-25 09:15"),
            Map.of("id", 3, "referenceId", "IMPS/981203948102", "senderAccount", "SBIN0001042882", "receiverAccount", "UTILITY_BILL_PAY", "amount", 850.50, "type", "IMPS", "status", "SUCCESS", "date", "2026-09-24 18:04")
        );
        return ResponseEntity.ok(txns);
    }

    @GetMapping("/admin/metrics")
    public ResponseEntity<Map<String, Object>> getSystemMetrics() {
        return ResponseEntity.ok(Map.of(
            "totalUsers", 1420,
            "activeAccounts", 3105,
            "totalVolumeInr", "₹1,48,90,250.00",
            "systemHealth", "99.98%"
        ));
    }

    // --- Customer Endpoints ---

    @GetMapping("/customer/accounts")
    public ResponseEntity<List<Map<String, Object>>> getCustomerAccounts() {
        List<Map<String, Object>> accounts = List.of(
            Map.of("id", 101, "accountNumber", "SBIN0001042881", "ifscCode", "SBIN0001042", "accountType", "SAVINGS", "balance", 248500.75, "currency", "INR", "status", "ACTIVE"),
            Map.of("id", 102, "accountNumber", "SBIN0001042882", "ifscCode", "SBIN0001042", "accountType", "CURRENT", "balance", 34200.00, "currency", "INR", "status", "ACTIVE")
        );
        return ResponseEntity.ok(accounts);
    }

    @PostMapping("/customer/transfer")
    public ResponseEntity<Map<String, String>> performTransfer(@RequestBody Map<String, Object> transferPayload) {
        String recipient = (String) transferPayload.get("recipientAccount");
        Object amountObj = transferPayload.get("amount");
        String mode = (String) transferPayload.getOrDefault("mode", "UPI");
        return ResponseEntity.ok(Map.of(
            "message", mode + " transfer of ₹" + amountObj + " to " + recipient + " completed successfully!",
            "referenceId", mode + "/" + System.currentTimeMillis(),
            "status", "SUCCESS"
        ));
    }
}
