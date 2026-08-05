package com.turfchai.model.enums;

public enum SkillLevel {
    BEGINNER("Beginner"),
    INTERMEDIATE("Intermediate"),
    ADVANCED("Advanced"),
    ALL_LEVELS("All Levels");

    private final String label;

    SkillLevel(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    public static SkillLevel fromString(String text) {
        if (text == null) return ALL_LEVELS;
        for (SkillLevel b : SkillLevel.values()) {
            if (b.name().equalsIgnoreCase(text) || b.label.equalsIgnoreCase(text)) {
                return b;
            }
        }
        return ALL_LEVELS;
    }
}
