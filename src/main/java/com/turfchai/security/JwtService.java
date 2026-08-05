package com.turfchai.security;

import com.turfchai.config.JwtProperties;
import com.turfchai.model.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private final JwtProperties properties;
    private final SecretKey secretKey;

    public JwtService(JwtProperties properties) {
        this.properties = properties;
        this.secretKey = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(User user) {
        return generateToken(user, "access", properties.expirationMs());
    }

    public String generateRefreshToken(User user) {
        return generateToken(user, "refresh", properties.refreshExpirationMs());
    }

    private String generateToken(User user, String type, long ttlMs) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getPublicId())
                .claim("uid", user.getId())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .claim("name", user.getFullName())
                .claim("type", type)
                .issuer(properties.issuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(ttlMs)))
                .signWith(secretKey)
                .compact();
    }

    public String extractPublicId(String token) {
        return parseClaims(token).getSubject();
    }

    public long expirationMs() {
        return properties.expirationMs();
    }

    public long refreshExpirationMs() {
        return properties.refreshExpirationMs();
    }

    public boolean isValid(String token) {
        try {
            Claims claims = parseClaims(token);
            return properties.issuer().equals(claims.getIssuer()) && claims.getExpiration().after(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /** Validates a refresh token: must be well-formed, unexpired, and of type "refresh". */
    public boolean isValidRefreshToken(String token) {
        try {
            Claims claims = parseClaims(token);
            return properties.issuer().equals(claims.getIssuer())
                    && "refresh".equals(claims.get("type", String.class))
                    && claims.getExpiration().after(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .requireIssuer(properties.issuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
