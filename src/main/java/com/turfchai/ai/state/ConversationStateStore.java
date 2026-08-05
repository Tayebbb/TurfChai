package com.turfchai.ai.state;

/**
 * Per-session application state storage — separate from conversation
 * memory by design: chat history is never used as the source of truth
 * for booking details.
 */
public interface ConversationStateStore {

    /** Returns the existing state or a fresh one bound to the session. */
    BookingState get(String sessionId);

    void clear(String sessionId);
}
