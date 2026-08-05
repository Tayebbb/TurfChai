package com.turfchai.ai.agent;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Deterministic keyword-based intent classification. Intentionally simple:
 * it only steers planning (RAG on/off, tool scoping) — the LLM still sees
 * the full message. Can be replaced by an LLM/classifier implementation
 * behind the same signature.
 */
public class IntentRouter {

    private static final Map<Intent, Pattern> RULES = Map.of(
            Intent.POLICY_QUESTION, compile("refund", "cancel policy", "cancellation", "policy",
                    "loyalty", "reward", "tier", "platform fee", "deposit", "faq",
                    "how does", "how do", "what is", "what are", "rules"),
            Intent.PAYMENT, compile("payment", "pay", "paid", "bkash", "nagad", "card", "transaction", "receipt"),
            Intent.TOURNAMENT, compile("tournament", "cup", "knockout", "fixture", "prize", "entry fee"),
            Intent.PROFILE, compile("my profile", "my points", "my wallet", "my tier", "reliability", "my account"),
            Intent.BOOKING, compile("book", "booking", "bookings", "reserve", "reservation", "slot", "slots",
                    "availability", "available"),
            Intent.VENUE_SEARCH, compile("venue", "turf", "field", "pitch", "court", "ground", "play", "near"),
            Intent.SMALL_TALK, compile("hi", "hello", "hey", "thanks", "thank you", "bye"));

    /**
     * Priority order. POLICY_QUESTION outranks BOOKING so grounded (RAG)
     * answers win for questions like "what is the refund policy for a booking?".
     */
    private static final List<Intent> PRIORITY = List.of(
            Intent.POLICY_QUESTION, Intent.PAYMENT, Intent.TOURNAMENT, Intent.PROFILE,
            Intent.BOOKING, Intent.VENUE_SEARCH, Intent.SMALL_TALK);

    public Intent route(String message) {
        if (message == null || message.isBlank()) {
            return Intent.GENERAL;
        }
        String normalized = message.toLowerCase(Locale.ROOT).strip();
        for (Intent intent : PRIORITY) {
            if (RULES.get(intent).matcher(normalized).find()) {
                return intent;
            }
        }
        return Intent.GENERAL;
    }

    private static Pattern compile(String... keywords) {
        // \b word boundaries prevent e.g. "book" matching "facebook"
        String joined = String.join("|", keywords);
        return Pattern.compile("\\b(?:" + joined + ")\\b");
    }
}
