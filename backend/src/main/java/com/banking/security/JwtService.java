package com.banking.security;

import com.banking.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

/** Issues and verifies the signed JWTs that authenticate REST API calls. */
@Service
public class JwtService {

    private final SecretKey key;
    private final Duration lifetime;

    public JwtService(@Value("${bank.jwt.secret}") String secret,
                      @Value("${bank.jwt.expiration-minutes}") long expirationMinutes) {
        this.key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.lifetime = Duration.ofMinutes(expirationMinutes);
    }

    /** Signs a token that identifies the user. */
    public String issue(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(lifetime)))
                .signWith(key)
                .compact();
    }

    /** Returns the user id if the token is valid and unexpired. */
    public Optional<Long> parseUserId(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(Long.valueOf(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }
}
