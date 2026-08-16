package com.turfchai.config;

import com.turfchai.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtAuthenticationFilter;
        private final UserDetailsService userDetailsService;
        private final com.turfchai.security.ApiSecurityErrorHandler apiSecurityErrorHandler;

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public AuthenticationProvider authenticationProvider() {
                DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
                provider.setPasswordEncoder(passwordEncoder());
                return provider;
        }

        @Bean
        public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
                return configuration.getAuthenticationManager();
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .csrf(csrf -> csrf.disable())
                                .cors(cors -> {
                                })
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .authorizeHttpRequests(auth -> auth
                                                // ── Authentication entry points ───────────────────────
                                                .requestMatchers(HttpMethod.POST,
                                                                "/api/v1/auth/register",
                                                                "/api/v1/auth/login",
                                                                "/api/v1/auth/refresh-token",
                                                                "/api/v1/auth/otp/request",
                                                                "/api/v1/auth/otp/verify",
                                                                // Admin 2FA: step 1 issues no token, step 2 returns
                                                                // the JWT only after the code is verified.
                                                                "/api/v1/admin/auth/login",
                                                                "/api/v1/admin/auth/login/verify")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/v1/auth/check-email").permitAll()

                                                // ── Infrastructure ────────────────────────────────────
                                                .requestMatchers(HttpMethod.GET, "/api/v1/health", "/actuator/health")
                                                .permitAll()
                                                .requestMatchers("/error").permitAll()

                                                // ── Public catalogue (READ ONLY) ──────────────────────
                                                // Venue discovery and slot availability are genuinely
                                                // public: a visitor must be able to browse and see when a
                                                // pitch is free before signing up. Only GET is opened —
                                                // every write under these paths stays authenticated.
                                                .requestMatchers(HttpMethod.GET,
                                                                "/api/v1/venues",
                                                                "/api/v1/venues/explore",
                                                                "/api/v1/venues/*",
                                                                "/api/v1/venues/*/reviews",
                                                                "/api/v1/venues/*/slots",
                                                                "/api/v1/venues/*/slots/stream")
                                                .permitAll()
                                                .requestMatchers(HttpMethod.GET,
                                                                "/api/v1/solo/open-games",
                                                                "/api/v1/solo/open-games/*",
                                                                "/api/v1/solo/open-games/*/members")
                                                .permitAll()
                                                // Catalogue only — balances, redemption and the points
                                                // ledger stay behind authentication.
                                                .requestMatchers(HttpMethod.GET, "/api/v1/rewards/products").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/v1/rewards/tiers").permitAll()
                                                // Checkout helper: validates a code against an order total.
                                                .requestMatchers(HttpMethod.POST, "/api/v1/promotions/validate-code")
                                                .permitAll()

                                                // ── AI assistant ──────────────────────────────────────
                                                // The chat widget is on public marketing pages, so the
                                                // chat call itself is open. Operational endpoints are not:
                                                // session ids are client-supplied strings, so an open
                                                // delete lets anyone wipe another visitor's transcript.
                                                .requestMatchers(HttpMethod.POST, "/api/ai/chat").permitAll()
                                                .requestMatchers(HttpMethod.GET, "/api/ai/metrics")
                                                .hasAnyRole("ADMIN", "SUPER_ADMIN")
                                                .requestMatchers("/api/ai/**").authenticated()

                                                // ── API documentation ─────────────────────────────────
                                                // Describes every route, parameter and schema; that is a
                                                // roadmap for an attacker, so it is staff-only.
                                                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**",
                                                                "/swagger-ui.html")
                                                .hasAnyRole("ADMIN", "SUPER_ADMIN")

                                                // ── Role-scoped namespaces ────────────────────────────
                                                .requestMatchers("/api/v1/admin/**").hasAnyRole("ADMIN", "SUPER_ADMIN")
                                                .requestMatchers("/api/v1/owner/**")
                                                .hasAnyRole("OWNER", "ADMIN", "SUPER_ADMIN")

                                                // Everything else — player profiles, saved venues,
                                                // bookings, payments, reviews, match-day check-in,
                                                // tournaments (player and host), tickets, LFG alerts,
                                                // notifications, media upload, pricing — requires a
                                                // verified principal. Deny by default.
                                                .anyRequest().authenticated())
                                .authenticationProvider(authenticationProvider())
                                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                                .exceptionHandling(exceptions -> exceptions
                                                .authenticationEntryPoint(apiSecurityErrorHandler)
                                                .accessDeniedHandler(apiSecurityErrorHandler));

                return http.build();
        }
}
