package com.turfchai.ai.memory;

import com.turfchai.ai.llm.ChatMessage;

import java.util.List;

/**
 * Conversation transcript storage, keyed by session. This is *dialogue
 * history only* — application facts (selected venue, date, players…) live
 * in the state module, never here.
 */
public interface ConversationMemory {

    void append(String sessionId, ChatMessage message);

    List<ChatMessage> history(String sessionId);

    void clear(String sessionId);
}
