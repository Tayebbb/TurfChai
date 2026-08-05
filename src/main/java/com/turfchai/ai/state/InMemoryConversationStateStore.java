package com.turfchai.ai.state;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class InMemoryConversationStateStore implements ConversationStateStore {

    private final Map<String, BookingState> states = new ConcurrentHashMap<>();

    @Override
    public BookingState get(String sessionId) {
        return states.computeIfAbsent(sessionId, k -> new BookingState());
    }

    @Override
    public void clear(String sessionId) {
        states.remove(sessionId);
    }
}
