package com.banking.security;

import com.banking.model.User;

/** The authenticated principal placed in the security context by {@link JwtAuthFilter}. */
public record AuthUser(Long id, String email, User.Role role) {
}
