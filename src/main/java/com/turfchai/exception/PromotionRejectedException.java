package com.turfchai.exception;

/**
 * A promo code was supplied at checkout but cannot be applied — unknown,
 * paused,
 * outside its dates, below the minimum order, wrong venue, or fully redeemed.
 *
 * <p>
 * Answered with 422, matching the public validate-code endpoint, so a client
 * can tell "your code was refused" apart from "your request was malformed".
 */
public class PromotionRejectedException extends RuntimeException {

    public PromotionRejectedException(String message) {
        super(message);
    }
}
