package com.turfchai.promotion.service;

import com.turfchai.promotion.dto.AppliedDiscountResponse;
import com.turfchai.promotion.dto.CreatePromotionRequest;
import com.turfchai.promotion.dto.PromotionDto;
import com.turfchai.promotion.dto.UpdatePromotionRequest;
import com.turfchai.promotion.dto.ValidatePromoCodeRequest;
import com.turfchai.promotion.repository.PromotionRepository;
import com.turfchai.model.User;
import com.turfchai.model.enums.RoleType;
import com.turfchai.repository.UserRepository;
import com.turfchai.venue.entity.Venue;
import com.turfchai.venue.repository.VenueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.List;
import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A promo code is only worth what the server says it is worth, and a redemption
 * is only spent when a booking actually completes.
 *
 * <p>
 * These cover the rules the checkout depends on: the discount maths and its
 * cap, every reason a code is refused, the usage limit under concurrent
 * redemption, and handing a use back when the booking is cancelled.
 */
@SpringBootTest
@ActiveProfiles({ "test", "dev" })
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:promo-redemption;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class PromotionRedemptionTest {

    @Autowired
    PromotionService promotionService;
    @Autowired
    PromotionRepository promotionRepository;
    @Autowired
    VenueRepository venueRepository;
    @Autowired
    UserRepository userRepository;

    private Venue venue;
    private Long ownerId;

    @BeforeEach
    void setUp() {
        User owner = userRepository.save(User.builder()
                .fullName("Promo Owner")
                .email("promo.owner." + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + java.util.concurrent.ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .role(RoleType.OWNER)
                .build());
        ownerId = owner.getId();
        venue = venueRepository.save(Venue.builder()
                .slug("promo-arena-" + System.nanoTime())
                .name("Promo Arena")
                .area("Dhanmondi")
                .address("1 Promo Road")
                .owner(owner)
                .status("LIVE")
                .basePrice(BigDecimal.valueOf(2000))
                .build());
    }

    private PromotionDto create(String code, String type, BigDecimal value,
            BigDecimal minOrder, BigDecimal maxDiscount, Integer usageLimit) {
        return promotionService.createPromotion(ownerId, venue.getId(), new CreatePromotionRequest(
                code, "Test promo", type, value, minOrder, maxDiscount, null, null, null, usageLimit));
    }

    private AppliedDiscountResponse quote(String code, BigDecimal orderTotal) {
        return promotionService.validateAndApply(new ValidatePromoCodeRequest(code, orderTotal, venue.getId()));
    }

    /**
     * What the owner console shows for this code — a locking read needs a
     * transaction.
     */
    private PromotionDto asOwnerSees(String code) {
        return promotionService.listByVenue(ownerId, venue.getId()).stream()
                .filter(p -> p.code().equalsIgnoreCase(code))
                .findFirst()
                .orElseThrow();
    }

    @Test
    void aPercentageCodeDiscountsTheOrderAndLeavesTheRestPayable() {
        create("SAVE20", "PERCENT", BigDecimal.valueOf(20), BigDecimal.ZERO, null, null);

        AppliedDiscountResponse applied = quote("SAVE20", BigDecimal.valueOf(2000));

        assertThat(applied.valid()).isTrue();
        assertThat(applied.discountAmount()).isEqualByComparingTo("400.00");
        assertThat(applied.finalTotal()).isEqualByComparingTo("1600.00");
    }

    @Test
    void theMaximumDiscountCapIsEnforced() {
        create("BIG50", "PERCENT", BigDecimal.valueOf(50), BigDecimal.ZERO, BigDecimal.valueOf(300), null);

        AppliedDiscountResponse applied = quote("BIG50", BigDecimal.valueOf(4000));

        // 50% of 4000 is 2000, but the owner capped the giveaway at 300.
        assertThat(applied.discountAmount()).isEqualByComparingTo("300.00");
        assertThat(applied.finalTotal()).isEqualByComparingTo("3700.00");
    }

    @Test
    void aFlatCodeNeverDiscountsMoreThanTheOrderItself() {
        create("FLAT5000", "FLAT", BigDecimal.valueOf(5000), BigDecimal.ZERO, null, null);

        AppliedDiscountResponse applied = quote("FLAT5000", BigDecimal.valueOf(1200));

        assertThat(applied.discountAmount()).isEqualByComparingTo("1200.00");
        assertThat(applied.finalTotal()).isEqualByComparingTo("0.00");
    }

    @Test
    void aCodeIsUsableTheMomentItIsPublished() {
        // The owner publishes a code and a player uses it on the next request.
        // Storing "starts now" and reading it back must not push the start of
        // the window past the clock, or the code is born unusable.
        for (int i = 0; i < 25; i++) {
            String code = "PUBLISHED" + i;
            create(code, "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, null);

            AppliedDiscountResponse applied = quote(code, BigDecimal.valueOf(2000));

            assertThat(applied.valid())
                    .as("attempt %d refused with: %s", i, applied.message())
                    .isTrue();
        }
    }

    @Test
    void anUnknownCodeIsRefused() {
        assertThat(quote("NOSUCHCODE", BigDecimal.valueOf(2000)).valid()).isFalse();
    }

    @Test
    void aPausedCodeIsRefused() {
        PromotionDto promo = create("PAUSED", "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, null);
        promotionService.updatePromotion(ownerId, venue.getId(), promo.id(),
                new UpdatePromotionRequest(false, null, null, null, null, null, null, null, null));

        assertThat(quote("PAUSED", BigDecimal.valueOf(2000)).valid()).isFalse();
    }

    @Test
    void anExpiredCodeIsRefused() {
        promotionService.createPromotion(ownerId, venue.getId(), new CreatePromotionRequest(
                "LASTYEAR", "Expired", "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, null,
                Instant.now().minus(60, ChronoUnit.DAYS), Instant.now().minus(30, ChronoUnit.DAYS), null));

        AppliedDiscountResponse applied = quote("LASTYEAR", BigDecimal.valueOf(2000));

        assertThat(applied.valid()).isFalse();
        assertThat(applied.message()).containsIgnoringCase("expired");
    }

    @Test
    void anOrderBelowTheMinimumIsRefused() {
        create("MIN3000", "PERCENT", BigDecimal.TEN, BigDecimal.valueOf(3000), null, null);

        AppliedDiscountResponse applied = quote("MIN3000", BigDecimal.valueOf(1000));

        assertThat(applied.valid()).isFalse();
        assertThat(applied.message()).containsIgnoringCase("minimum");
    }

    @Test
    void aCodeDoesNotApplyAtAnotherVenue() {
        create("MINEONLY", "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, null);

        AppliedDiscountResponse applied = promotionService.validateAndApply(
                new ValidatePromoCodeRequest("MINEONLY", BigDecimal.valueOf(2000), venue.getId() + 9999));

        assertThat(applied.valid()).isFalse();
    }

    @Test
    void anExhaustedCodeIsRefusedAndCannotBeRedeemedAgain() {
        create("ONCE", "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, 1);

        assertThat(promotionService.recordUsage(venue.getId(), "ONCE")).isTrue();
        assertThat(promotionService.recordUsage(venue.getId(), "ONCE")).isFalse();
        assertThat(quote("ONCE", BigDecimal.valueOf(2000)).valid()).isFalse();
    }

    @Test
    void concurrentRedemptionsNeverOvershootTheUsageLimit() throws Exception {
        create("RACE", "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, 3);

        int attempts = 12;
        ExecutorService pool = Executors.newFixedThreadPool(attempts);
        AtomicInteger granted = new AtomicInteger();
        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < attempts; i++) {
            futures.add(pool.submit(() -> {
                if (promotionService.recordUsage(venue.getId(), "RACE")) {
                    granted.incrementAndGet();
                }
            }));
        }
        for (Future<?> f : futures) {
            f.get(20, TimeUnit.SECONDS);
        }
        pool.shutdown();

        assertThat(granted.get()).isEqualTo(3);
        assertThat(asOwnerSees("RACE").usageCount()).isEqualTo(3);
    }

    @Test
    void cancellingHandsTheRedemptionBackAndReopensAnExhaustedCode() {
        create("GIVEBACK", "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, 1);

        assertThat(promotionService.recordUsage(venue.getId(), "GIVEBACK")).isTrue();
        assertThat(asOwnerSees("GIVEBACK").active()).isFalse();

        promotionService.releaseUsage(venue.getId(), "GIVEBACK");

        PromotionDto reopened = asOwnerSees("GIVEBACK");
        assertThat(reopened.usageCount()).isZero();
        assertThat(reopened.active()).isTrue();
        assertThat(quote("GIVEBACK", BigDecimal.valueOf(2000)).valid()).isTrue();
    }

    @Test
    void twoVenuesMayRunTheSameCodeAndEachGetsItsOwnTerms() {
        // Codes are unique per venue, not globally. A global lookup picked one of
        // them arbitrarily and refused the other venue's genuine code.
        create("SHARED", "PERCENT", BigDecimal.valueOf(10), BigDecimal.ZERO, null, null);

        User otherOwner = userRepository.save(User.builder()
                .fullName("Other Owner")
                .email("other.owner." + System.nanoTime() + "@turfchai.test")
                .phone("+88017" + java.util.concurrent.ThreadLocalRandom.current().nextInt(10_000_000, 99_999_999))
                .passwordHash("x")
                .role(RoleType.OWNER)
                .build());
        Venue otherVenue = venueRepository.save(Venue.builder()
                .slug("other-arena-" + System.nanoTime())
                .name("Other Arena")
                .area("Banani")
                .address("2 Other Road")
                .owner(otherOwner)
                .status("LIVE")
                .basePrice(BigDecimal.valueOf(2000))
                .build());
        promotionService.createPromotion(otherOwner.getId(), otherVenue.getId(), new CreatePromotionRequest(
                "SHARED", "Other promo", "PERCENT", BigDecimal.valueOf(50),
                BigDecimal.ZERO, null, null, null, null, null));

        AppliedDiscountResponse mine = quote("SHARED", BigDecimal.valueOf(2000));
        AppliedDiscountResponse theirs = promotionService.validateAndApply(
                new ValidatePromoCodeRequest("SHARED", BigDecimal.valueOf(2000), otherVenue.getId()));

        assertThat(mine.valid()).isTrue();
        assertThat(mine.discountAmount()).isEqualByComparingTo("200.00");
        assertThat(theirs.valid()).isTrue();
        assertThat(theirs.discountAmount()).isEqualByComparingTo("1000.00");
    }

    @Test
    void releasingNeverDrivesTheCountNegative() {
        create("FLOOR", "PERCENT", BigDecimal.TEN, BigDecimal.ZERO, null, null);

        promotionService.releaseUsage(venue.getId(), "FLOOR");
        promotionService.releaseUsage(venue.getId(), "FLOOR");

        assertThat(asOwnerSees("FLOOR").usageCount()).isZero();
    }
}
