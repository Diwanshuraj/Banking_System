package com.banking.controller;

import com.banking.dto.AuthDtos.*;
import com.banking.security.AuthUser;
import com.banking.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/** Public login and sign-up endpoints, plus the signed-in user's profile. */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /** Signs in with an email address or 11-digit customer ID. */
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    /** Online sign-up: creates the customer, opens their first account and signs them in. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    /** The signed-in user's profile. */
    @GetMapping("/me")
    public UserDto me(@AuthenticationPrincipal AuthUser user) {
        return authService.me(user.id());
    }
}
