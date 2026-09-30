package com.banking.service;

import com.banking.dto.BankingDtos.TransferMode;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.function.Predicate;

/** Generates customer-facing identifiers (CIF, account numbers, reference IDs). */
@Component
public class IdGenerator {

    private final SecureRandom random = new SecureRandom();

    public String digits(int length) {
        StringBuilder builder = new StringBuilder(length);
        builder.append(1 + random.nextInt(9));
        while (builder.length() < length) builder.append(random.nextInt(10));
        return builder.toString();
    }

    /** Retries until {@code taken} says the value is free. */
    public String unique(java.util.function.Supplier<String> candidate, Predicate<String> taken) {
        for (int attempt = 0; attempt < 20; attempt++) {
            String value = candidate.get();
            if (!taken.test(value)) return value;
        }
        throw new IllegalStateException("Could not generate a unique identifier");
    }

    public String customerId() {
        return digits(11);
    }

    public String accountNumber() {
        return "3" + digits(10);
    }

    /** Reference numbers in the style each payment rail uses (UPI RRN, NEFT UTR, ...). */
    public String reference(String prefix) {
        return switch (prefix) {
            case "UPI" -> "UPI" + digits(12);
            case "IMPS" -> "IMPS" + digits(12);
            case "NEFT" -> "BNBIN" + digits(11);
            case "RTGS" -> "BNBIR" + digits(11);
            default -> prefix + digits(12);
        };
    }

    public String reference(TransferMode mode) {
        return mode == TransferMode.INTERNAL ? reference("TRF") : reference(mode.name());
    }
}
