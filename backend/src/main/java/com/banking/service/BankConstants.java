package com.banking.service;

import java.util.Map;

/** Fixed facts about the bank and the Indian payment systems it uses. */
public final class BankConstants {

    private BankConstants() {
    }

    public static final String BANK_NAME = "Bharat National Bank";
    public static final String BANK_IFSC_PREFIX = "BNBI";
    public static final String HOME_IFSC = "BNBI0001042";
    public static final String HOME_BRANCH = "Connaught Place, New Delhi";
    public static final String UPI_HANDLE = "@bnb";

    /** Newly added payees can receive at most this much per transfer during the first 24 hours. */
    public static final long PAYEE_COOLING_HOURS = 24;

    private static final Map<String, String> BANKS_BY_IFSC_PREFIX = Map.ofEntries(
            Map.entry("BNBI", BANK_NAME),
            Map.entry("SBIN", "State Bank of India"),
            Map.entry("HDFC", "HDFC Bank"),
            Map.entry("ICIC", "ICICI Bank"),
            Map.entry("UTIB", "Axis Bank"),
            Map.entry("PUNB", "Punjab National Bank"),
            Map.entry("KKBK", "Kotak Mahindra Bank"),
            Map.entry("BARB", "Bank of Baroda"),
            Map.entry("CNRB", "Canara Bank"),
            Map.entry("UBIN", "Union Bank of India"),
            Map.entry("IDIB", "Indian Bank"),
            Map.entry("YESB", "Yes Bank"),
            Map.entry("INDB", "IndusInd Bank"),
            Map.entry("IDFB", "IDFC FIRST Bank"));

    public static String bankNameForIfsc(String ifsc) {
        return BANKS_BY_IFSC_PREFIX.getOrDefault(ifsc.substring(0, 4).toUpperCase(), "Other bank");
    }

    public static boolean isOwnBankIfsc(String ifsc) {
        return ifsc.toUpperCase().startsWith(BANK_IFSC_PREFIX);
    }
}
