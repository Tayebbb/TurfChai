package com.turfchai.ai.memory;

import com.turfchai.ai.llm.ChatMessage;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Bounded in-memory conversation store: keeps at most {@code maxMessages}
 * per session (sliding window) and evicts the least-recently-used session
 * beyond {@code maxSessions}. Swap for Redis/DB for multi-instance deploys.
 */
public class InMemoryConversationMemory implements ConversationMemory {

    private final int maxMessages;
    private final Map<String, Deque<ChatMessage>> sessions;

    public InMemoryConversationMemory(int maxMessages, int maxSessions) {
        this.maxMessages = maxMessages;
        this.sessions = new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Deque<ChatMessage>> eldest) {
                return size() > maxSessions;
            }
        };
    }

    @Override
    public synchronized void append(String sessionId, ChatMessage message) {
        Deque<ChatMessage> messages = sessions.computeIfAbsent(sessionId, k -> new ArrayDeque<>());
        messages.addLast(message);
        while (messages.size() > maxMessages) {
            messages.removeFirst();
        }
    }

    @Override
    public synchronized List<ChatMessage> history(String sessionId) {
        Deque<ChatMessage> messages = sessions.get(sessionId);
        return messages == null ? List.of() : new ArrayList<>(messages);
    }

    @Override
    public synchronized void clear(String sessionId) {
        sessions.remove(sessionId);
    }
}
