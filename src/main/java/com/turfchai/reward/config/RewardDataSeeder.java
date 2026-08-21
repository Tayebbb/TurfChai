package com.turfchai.reward.config;

import com.turfchai.player.api.UserProfileRestController;
import com.turfchai.repository.UserRepository;
import com.turfchai.reward.entity.LoyaltyTier;
import com.turfchai.reward.entity.RewardKind;
import com.turfchai.reward.entity.RewardProduct;
import com.turfchai.reward.repository.LoyaltyTierRepository;
import com.turfchai.reward.repository.PointLedgerRepository;
import com.turfchai.reward.repository.RewardProductRepository;
import com.turfchai.reward.service.RewardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.Map;

/**
 * Seeds {@code loyalty_tiers} and {@code reward_products} for the H2 dev/test
 * profiles, which skip Flyway (see {@code application-dev.properties}) and so
 * never run the V1 baseline's seed rows. Mirrors those rows exactly — see
 * {@code V1__baseline.sql} section 18 and
 * {@code ai-knowledge/loyalty-rewards.md}.
 * Also grants the demo player ({@code rafi@turfchai.dev}) a starting point
 * history so the rewards page has something to show on a fresh checkout.
 */
@Configuration
@Profile({ "dev", "test", "ci", "docker" })
public class RewardDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(RewardDataSeeder.class);

    @Bean
    @Order(3) // after the demo player/venues — needs the demo user to already exist
    CommandLineRunner seedRewards(LoyaltyTierRepository tiers, RewardProductRepository products,
            PointLedgerRepository ledger, UserRepository users, RewardService rewardService) {
        return args -> {
            seedCatalog(tiers, products);
            seedDemoPlayerHistory(ledger, users, rewardService);
        };
    }

    @Transactional
    void seedCatalog(LoyaltyTierRepository tiers, RewardProductRepository products) {
        if (tiers.count() == 0) {
            tiers.save(LoyaltyTier.builder()
                    .name("BRONZE")
                    .minPoints(0)
                    .discountPercent(BigDecimal.ZERO)
                    .perks(Map.of("priority_booking", false, "free_extension_min", 0))
                    .sortOrder((short) 1)
                    .build());
            tiers.save(LoyaltyTier.builder()
                    .name("SILVER")
                    .minPoints(500)
                    .discountPercent(BigDecimal.valueOf(5))
                    .perks(Map.of("priority_booking", false, "free_extension_min", 15))
                    .sortOrder((short) 2)
                    .build());
            tiers.save(LoyaltyTier.builder()
                    .name("GOLD")
                    .minPoints(1500)
                    .discountPercent(BigDecimal.TEN)
                    .perks(Map.of("priority_booking", false, "free_extension_min", 30))
                    .sortOrder((short) 3)
                    .build());
            tiers.save(LoyaltyTier.builder()
                    .name("PLATINUM")
                    .minPoints(5000)
                    .discountPercent(BigDecimal.valueOf(15))
                    .perks(Map.of("priority_booking", true, "free_extension_min", 30))
                    .sortOrder((short) 4)
                    .build());
            log.info("Seeded 4 loyalty tiers");
        }

        if (products.count() == 0) {
            products.save(RewardProduct.builder()
                    .name("৳50 off").kind(RewardKind.WALLET_CREDIT).costPoints(500)
                    .value(BigDecimal.valueOf(50)).description("BDT 50 wallet credit").isActive(true).build());
            products.save(RewardProduct.builder()
                    .name("৳150 off").kind(RewardKind.WALLET_CREDIT).costPoints(1000)
                    .value(BigDecimal.valueOf(150)).description("BDT 150 wallet credit").isActive(true).build());
            products.save(RewardProduct.builder()
                    .name("Free 1-hr slot").kind(RewardKind.FREE_SLOT).costPoints(2000)
                    .value(BigDecimal.ONE).description("Free 1-hour slot").isActive(true).build());
            products.save(RewardProduct.builder()
                    .name("10% off next booking").kind(RewardKind.DISCOUNT_NEXT).costPoints(2500)
                    .value(BigDecimal.TEN).description("10% off next booking").isActive(true).build());
            products.save(RewardProduct.builder()
                    .name("Priority Booking Pass").kind(RewardKind.PRIORITY_PASS).costPoints(3000)
                    .value(null).description("Priority booking pass").isActive(true).build());
            log.info("Seeded 5 reward products");
        }
    }

    /**
     * Grants the demo player a realistic point history (2,740 pts — Gold tier,
     * 35% of the way to Platinum) so the rewards page isn't empty on first load.
     * Booking points use the live ৳1 = 1 pt rule against the demo net amounts.
     * Idempotent: skipped if the demo user already has any ledger entries.
     */
    @Transactional
    void seedDemoPlayerHistory(PointLedgerRepository ledger, UserRepository users, RewardService rewardService) {
        users.findByPublicId(com.turfchai.player.config.PlayerDataSeeder.DEMO_PLAYER_PUBLIC_ID.toString())
                .ifPresent(demoUser -> {
                    Long userId = demoUser.getId();
                    if (!ledger.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, 1)).isEmpty()) {
                        return;
                    }

                    rewardService.awardProfileCompletionPointsOnce(userId); // 10
                    rewardService.awardMonthlyActivityBonus(userId, 1000, "Early adopter loyalty reward");
                    rewardService.awardMonthlyActivityBonus(userId, 800, "Frequent match player milestone");
                    rewardService.awardMonthlyActivityBonus(userId, 500, "Welcome bonus");
                    rewardService.awardMonthlyActivityBonus(userId, 430, "Monthly active leaderboard reward");
                    // Total: 10 + 1000 + 800 + 500 + 430 = 2,740 pts (Gold tier, 35% to Platinum)

                    log.info("Seeded demo player point history: 2,740 pts for {}", demoUser.getEmail());
                });
    }
}
