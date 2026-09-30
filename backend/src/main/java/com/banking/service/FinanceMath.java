package com.banking.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Interest formulas. The frontend's lib/format.ts uses the same ones for previews. */
public final class FinanceMath {

    private FinanceMath() {
    }

    private static BigDecimal money(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    /** FD value with quarterly compounding after {@code months}. */
    public static BigDecimal fdMaturity(BigDecimal principal, BigDecimal annualRate, int months) {
        return fdValue(principal, annualRate, months / 3.0);
    }

    /** FD value with quarterly compounding after {@code days} (used for accrual and early closure). */
    public static BigDecimal fdValueAfterDays(BigDecimal principal, BigDecimal annualRate, long days) {
        return fdValue(principal, annualRate, 4.0 * days / 365.0);
    }

    private static BigDecimal fdValue(BigDecimal principal, BigDecimal annualRate, double quarters) {
        double rate = annualRate.doubleValue() / 400.0;
        return money(principal.doubleValue() * Math.pow(1 + rate, quarters));
    }

    /** Reducing-balance EMI. */
    public static BigDecimal emi(BigDecimal principal, BigDecimal annualRate, int months) {
        double p = principal.doubleValue();
        double r = annualRate.doubleValue() / 12 / 100;
        if (r == 0) return money(p / months);
        double factor = Math.pow(1 + r, months);
        return money(p * r * factor / (factor - 1));
    }

    /** One month's interest on the outstanding principal. */
    public static BigDecimal monthlyInterest(BigDecimal outstanding, BigDecimal annualRate) {
        return outstanding.multiply(annualRate).divide(BigDecimal.valueOf(1200), 2, RoundingMode.HALF_UP);
    }
}
