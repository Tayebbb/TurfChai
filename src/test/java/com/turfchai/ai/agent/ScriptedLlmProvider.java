package com.turfchai.ai.agent;

import com.turfchai.ai.llm.LlmProvider;
import com.turfchai.ai.llm.LlmRequest;
import com.turfchai.ai.llm.LlmResponse;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/** Test double that replays scripted responses and records requests. */
class ScriptedLlmProvider implements LlmProvider {

    private final Deque<LlmResponse> script = new ArrayDeque<>();
    final List<LlmRequest> requests = new ArrayList<>();

    ScriptedLlmProvider enqueue(LlmResponse response) {
        script.addLast(response);
        return this;
    }

    @Override
    public String name() {
        return "scripted";
    }

    @Override
    public LlmResponse chat(LlmRequest request) {
        requests.add(request);
        if (script.isEmpty()) {
            throw new IllegalStateException("Script exhausted");
        }
        return script.removeFirst();
    }
}
