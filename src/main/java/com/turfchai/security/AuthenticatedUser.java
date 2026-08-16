package com.turfchai.security;

import com.turfchai.exception.UnauthenticatedException;

import java.util.UUID;

/**
 * Single place where a handler turns "the caller" into a user id.
 *
 * <p>
 * Identity is only ever read from the verified {@link UserPrincipal} that the
 * JWT filter put in the security context. Client-supplied identity — headers
 * such as {@code X-User-Id}, request-body {@code userId} fields, query
 * parameters — must never reach this class.
 */
public final class AuthenticatedUser {

    private AuthenticatedUser() {
    }

    /** The authenticated principal, or 401 if the request has none. */
    public static UserPrincipal require(UserPrincipal principal) {
        if (principal == null) {
            throw new UnauthenticatedException("Authentication required");
        }
        return principal;
    }

    /** Database id of the authenticated caller. */
    public static Long requireId(UserPrincipal principal) {
        return require(principal).getId();
    }

    /** Public UUID of the authenticated caller. */
    public static UUID requirePublicId(UserPrincipal principal) {
        UserPrincipal user = require(principal);
        try {
            return UUID.fromString(user.getPublicId());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new UnauthenticatedException("Authenticated principal has no valid public id");
        }
    }
}
