package com.turfchai.ai.memory;

import com.turfchai.ai.llm.ChatMessage;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InMemoryConversationMemoryTest {

    @Test
    void appendsAndReadsInOrder() {
        InMemoryConversationMemory memory = new InMemoryConversationMemory(10, 10);
        memory.append("s1", ChatMessage.user("hello"));
        memory.append("s1", ChatMessage.assistant("hi there"));

        assertThat(memory.history("s1")).hasSize(2);
        assertThat(memory.history("s1").get(0).content()).isEqualTo("hello");
    }

    @Test
    void enforcesSlidingWindow() {
        InMemoryConversationMemory memory = new InMemoryConversationMemory(3, 10);
        for (int i = 1; i <= 5; i++) {
            memory.append("s1", ChatMessage.user("m" + i));
        }
        assertThat(memory.history("s1"))
                .extracting(ChatMessage::content)
                .containsExactly("m3", "m4", "m5");
    }

    @Test
    void evictsOldestSessionBeyondCapacity() {
        InMemoryConversationMemory memory = new InMemoryConversationMemory(10, 2);
        memory.append("s1", ChatMessage.user("a"));
        memory.append("s2", ChatMessage.user("b"));
        memory.append("s3", ChatMessage.user("c"));

        assertThat(memory.history("s1")).isEmpty();
        assertThat(memory.history("s3")).hasSize(1);
    }

    @Test
    void sessionsAreIsolatedAndClearable() {
        InMemoryConversationMemory memory = new InMemoryConversationMemory(10, 10);
        memory.append("s1", ChatMessage.user("a"));
        memory.append("s2", ChatMessage.user("b"));

        memory.clear("s1");

        assertThat(memory.history("s1")).isEmpty();
        assertThat(memory.history("s2")).hasSize(1);
    }
}
