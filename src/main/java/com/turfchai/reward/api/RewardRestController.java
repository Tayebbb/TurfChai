package com.turfchai.reward.api;

import com.turfchai.dto.ApiResponse;
import com.turfchai.reward.dto.request.RedeemRewardRequest;
import com.turfchai.reward.dto.response.PointActivityResponse;
import com.turfchai.reward.dto.response.PointsSummaryResponse;
import com.turfchai.reward.dto.response.RedemptionResponse;
import com.turfchai.reward.dto.response.RewardProductResponse;
import com.turfchai.reward.service.RewardService;
import com.turfchai.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Player Loyalty & Rewards Program REST API. Endpoints resolve the caller from
 * the JWT security principal; all of them require authentication except the
 * catalog, which visitors may browse before signing up.
 * Error handling is delegated to {@link com.turfchai.exception.GlobalExceptionHandler}.
 */
@RestController
@RequestMapping("/api/v1/rewards")
@RequiredArgsConstructor
public class RewardRestController {

    private final RewardService rewardService;

    /** GET /api/v1/rewards/products — active reward catalog, annotated with the caller's unlock state. */
    @GetMapping("/products")
    public ResponseEntity<ApiResponse<List<RewardProductResponse>>> listProducts(Authentication authentication) {
        List<RewardProductResponse> products = rewardService.listRewardProducts(optionalUserId(authentication));
        return ResponseEntity.ok(ApiResponse.ok(products));
    }

    /** POST /api/v1/rewards/redeem — spends points on a catalog item. */
    @PostMapping("/redeem")
    public ResponseEntity<ApiResponse<RedemptionResponse>> redeem(
            Authentication authentication,
            @Valid @RequestBody RedeemRewardRequest request) {
        RedemptionResponse redemption = rewardService.redeem(currentUserId(authentication), request.getRewardId());
        return ResponseEntity.ok(ApiResponse.ok(redemption, "Reward redeemed successfully"));
    }

    /** GET /api/v1/rewards/my-points — current balance, wallet balance, and tier progress. */
    @GetMapping("/my-points")
    public ResponseEntity<ApiResponse<PointsSummaryResponse>> myPoints(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(rewardService.getMyPoints(currentUserId(authentication))));
    }

    /** GET /api/v1/rewards/activity — recent points ledger entries, most recent first. */
    @GetMapping("/activity")
    public ResponseEntity<ApiResponse<List<PointActivityResponse>>> activity(
            Authentication authentication,
            @RequestParam(defaultValue = "30") int limit) {
        List<PointActivityResponse> activity = rewardService.getRecentActivity(currentUserId(authentication), limit);
        return ResponseEntity.ok(ApiResponse.ok(activity));
    }

    private Long currentUserId(Authentication authentication) {
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return principal.getId();
    }

    /** Null for anonymous callers on the public catalog route. */
    private Long optionalUserId(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            return null;
        }
        return principal.getId();
    }
}
