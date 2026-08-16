package com.turfchai.ai.tool.impl;

import com.turfchai.ai.tool.Tool;
import com.turfchai.ai.tool.ToolArgs;
import com.turfchai.ai.tool.ToolContext;
import com.turfchai.ai.tool.ToolResult;
import com.turfchai.ai.tool.ToolSpec;
import com.turfchai.booking.entity.BookingStatus;
import com.turfchai.booking.repository.BookingRepository;
import com.turfchai.model.User;
import com.turfchai.repository.UserRepository;
import com.turfchai.reward.dto.response.PointsSummaryResponse;
import com.turfchai.reward.dto.response.TierResponse;
import com.turfchai.reward.service.RewardService;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * The signed-in user's own profile, loyalty standing and wallet balance.
 *
 * <p>
 * The spec takes no arguments on purpose: there is no way for the model to
 * name a different user, and the row is read with the id the JWT filter
 * verified rather than anything the caller sent.
 */
@Component
public class UserProfileTool implements Tool {

    private final UserRepository userRepository;
    private final RewardService rewardService;
    private final BookingRepository bookingRepository;

    public UserProfileTool(UserRepository userRepository,
            RewardService rewardService,
            BookingRepository bookingRepository) {
        this.userRepository = userRepository;
        this.rewardService = rewardService;
        this.bookingRepository = bookingRepository;
    }

    @Override
    public ToolSpec spec() {
        return new ToolSpec(
                "get_user_profile",
                "Get the signed-in user's real profile: name, area, preferences, reliability score, loyalty tier, "
                        + "points balance, wallet balance and booking counts. Takes no arguments.",
                List.of());
    }

    @Override
    public ToolResult execute(Map<String, Object> arguments, ToolContext context) {
        if (!context.isAuthenticated()) {
            return ToolResult.fail("The user is not signed in, so there is no profile to read. "
                    + "Ask them to sign in at /auth.");
        }
        Long userId = context.authenticatedUserId();
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            return ToolResult.fail("That account no longer exists.");
        }

        PointsSummaryResponse points = rewardService.getMyPoints(userId);

        Map<String, Object> body = ToolArgs.row();
        ToolArgs.put(body, "fullName", user.getFullName());
        ToolArgs.put(body, "area", user.getArea());
        ToolArgs.put(body, "role", user.getRole());
        ToolArgs.put(body, "playerRole", user.getPlayerRole());
        ToolArgs.put(body, "playStyle", user.getPlayStyle());
        ToolArgs.put(body, "preferredSports", csv(user.getPreferredSports()));
        ToolArgs.put(body, "preferredTimes", csv(user.getPreferredTimes()));
        ToolArgs.put(body, "reliabilityScore", user.getReliabilityScore());
        ToolArgs.put(body, "gamesAttended", user.getGamesAttended());
        ToolArgs.put(body, "gamesNoShow", user.getGamesNoShow());

        ToolArgs.put(body, "pointsBalance", points.getBalance());
        ToolArgs.put(body, "walletBalanceBdt", points.getWalletBalance());
        ToolArgs.put(body, "currentTier", tierName(points.getCurrentTier()));
        ToolArgs.put(body, "nextTier", tierName(points.getNextTier()));
        ToolArgs.put(body, "pointsToNextTier", points.getPointsToNextTier());

        var bookings = bookingRepository.findByUserId(userId);
        body.put("totalBookings", bookings.size());
        body.put("confirmedBookings",
                bookings.stream().filter(b -> b.getStatus() == BookingStatus.CONFIRMED).count());

        return ToolResult.ok(body);
    }

    private static String tierName(TierResponse tier) {
        return tier == null ? null : tier.getName();
    }

    private static List<String> csv(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
