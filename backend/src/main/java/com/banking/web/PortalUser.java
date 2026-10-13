package com.banking.web;

import java.io.Serializable;

/** The signed-in customer, stored in the {@code HttpSession}. */
public record PortalUser(long id, String customerId, String fullName) implements Serializable {
}
