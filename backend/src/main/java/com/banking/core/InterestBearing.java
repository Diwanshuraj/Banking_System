package com.banking.core;

import java.math.BigDecimal;

/** Anything that earns interest on its balance. */
public interface InterestBearing {

    /** Interest for one month at the current balance. */
    BigDecimal monthlyInterest();

    /** Simple-interest estimate for a full year at the current balance. */
    default BigDecimal yearlyInterestEstimate() {
        return monthlyInterest().multiply(BigDecimal.valueOf(12));
    }
}
