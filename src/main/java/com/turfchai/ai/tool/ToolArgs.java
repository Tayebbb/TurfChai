package com.turfchai.ai.tool;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Coercion helpers for tool arguments. A model may send a number as a string,
 * a blank string for "not provided", or omit a key entirely, so every read has
 * to tolerate all three rather than throw.
 */
public final class ToolArgs {

    private ToolArgs() {
    }

    /** Trimmed value, or null when absent or blank. */
    public static String string(Map<String, Object> args, String key) {
        Object value = args.get(key);
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    public static Integer integer(Map<String, Object> args, String key) {
        Object value = args.get(key);
        if (value instanceof Number number) {
            return number.intValue();
        }
        String text = string(args, key);
        if (text == null) {
            return null;
        }
        try {
            return Integer.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static BigDecimal decimal(Map<String, Object> args, String key) {
        Object value = args.get(key);
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        String text = string(args, key);
        if (text == null) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** ISO {@code YYYY-MM-DD}, or null when absent or unparseable. */
    public static LocalDate date(Map<String, Object> args, String key) {
        String text = string(args, key);
        if (text == null) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (java.time.format.DateTimeParseException e) {
            return null;
        }
    }

    /** Clamps a model-supplied count so one tool call cannot pull the whole table. */
    public static int bounded(Integer value, int fallback, int min, int max) {
        int resolved = value == null ? fallback : value;
        return Math.min(Math.max(resolved, min), max);
    }

    /**
     * Mutable ordered row for a tool payload. {@code Map.of} rejects null
     * values, and most of these fields are genuinely nullable in the database.
     */
    public static Map<String, Object> row() {
        return new LinkedHashMap<>();
    }

    /** Adds a field only when it has a value, so absent data stays absent. */
    public static void put(Map<String, Object> row, String key, Object value) {
        if (value != null) {
            row.put(key, value);
        }
    }
}
