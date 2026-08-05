package com.turfchai.ai.prompt;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Loads version-controlled prompt resources from {@code classpath:/prompts/}
 * and caches them. Prompts are plain markdown files — never hardcoded in Java.
 */
public class PromptLoader {

    private static final String BASE_PATH = "/prompts/";

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    /** Loads {@code /prompts/<name>.md} from the classpath. */
    public String load(String name) {
        return cache.computeIfAbsent(name, this::read);
    }

    private String read(String name) {
        String path = BASE_PATH + name + ".md";
        try (InputStream in = PromptLoader.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new PromptException("Prompt resource not found: " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new PromptException("Failed to read prompt: " + path, e);
        }
    }
}
