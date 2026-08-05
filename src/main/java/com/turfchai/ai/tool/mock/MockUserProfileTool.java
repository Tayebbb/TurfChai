package com.turfchai.ai.tool.mock;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;

import java.util.List;
import java.util.Map;

/**
 * Mock profile lookup for the *current authenticated user only* — the tool
 * takes no user argument by design, so the model can never request another
 * user's data.
 */
public class MockUserProfileTool implements Tool {

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "get_user_profile",
                "Get the current user's profile: name, loyalty tier, points balance, wallet balance and reliability score. No arguments.",
                List.of());
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        if (context.userId() == null || context.userId().isBlank()) {
            return ToolResult.fail("No authenticated user in this session");
        }
        return ToolResult.ok(Map.of(
                "userId", context.userId(),
                "fullName", "Demo Player",
                "loyaltyTier", "gold",
                "pointsBalance", 1250,
                "walletBalanceBdt", 150,
                "reliabilityScore", 96,
                "preferredSports", List.of("football", "futsal"),
                "preferredAreas", List.of("Banani", "Gulshan")));
    }
}
