package com.turfchai.reward.service;

import com.turfchai.reward.dto.response.PointActivityResponse;
import com.turfchai.reward.dto.response.PointsSummaryResponse;
import com.turfchai.reward.dto.response.RedemptionResponse;
import com.turfchai.reward.dto.response.RewardProductResponse;
import com.turfchai.reward.dto.response.TierResponse;
import com.turfchai.reward.entity.LoyaltyTier;
import com.turfchai.reward.entity.PointLedgerEntry;
import com.turfchai.reward.entity.PointReason;
import com.turfchai.reward.entity.RedemptionStatus;
import com.turfchai.reward.entity.RewardKind;
import com.turfchai.reward.entity.RewardProduct;
import com.turfchai.reward.entity.RewardRedemption;
import com.turfchai.reward.entity.WalletReason;
import com.turfchai.reward.entity.WalletTransaction;
import com.turfchai.reward.repository.LoyaltyTierRepository;
import com.turfchai.reward.repository.PointLedgerRepository;
import com.turfchai.reward.repository.RewardProductRepository;
import com.turfchai.reward.repository.RewardRedemptionRepository;
import com.turfchai.reward.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

/**
 * Player Loyalty & Rewards Program: point accrual, tier calculation, and
 * reward redemption.
 * <p>
 * Point balances are computed by summing the {@code point_ledger} rather
 * than trusting a mutable counter, so the ledger stays the single source of
 * truth and every credit/debit is independently auditable (each row also
 * carries its own point-in-time {@code balance_after} snapshot).
 * </p>
 * <p>
 * <b>Concurrency note:</b> like the rest of the pre-launch codebase, this
 * service does not take a row lock while computing a balance for a debit —
 * {@link com.turfchai.booking.service.BookingService} uses pessimistic
 * locking for slot holds because double-booking is the critical race here;
 * two simultaneous redemptions by the same user is a far narrower window.
 * If that hardening is needed later, wrap {@link #redeem} in a lock on the
 * user's ledger (e.g. {@code SELECT ... FOR UPDATE} via a per-user marker
 * row) before recomputing the balance.
 * </p>
 */
@Service
@RequiredArgsConstructor
public class RewardService {

    /** Turf slots starting in [06:00, 17:00) are considered off-peak. */
    private static final LocalTime OFF_PEAK_START = LocalTime.of(6, 0);
    private static final LocalTime OFF_PEAK_END = LocalTime.of(17, 0);
    private static final int DEFAULT_ACTIVITY_LIMIT = 30;

    private final PointLedgerRepository pointLedgerRepository;
    private final LoyaltyTierRepository loyaltyTierRepository;
    private final RewardProductRepository rewardProductRepository;
    private final RewardRedemptionRepository rewardRedemptionRepository;
    private final WalletTransactionRepository walletTransactionRepository;

    // ── Earning ──────────────────────────────────────────────────────────

    /**
     * Generic entry point for crediting points. {@code points} must be
     * positive; use the reason-specific convenience methods below where a
     * fixed award applies.
     */
    @Transactional
    public PointLedgerEntry earnPoints(Long userId, PointReason reason, int points, Long bookingId, Long openGameId, String note) {
        if (points <= 0) {
            throw new IllegalArgumentException("Earned points must be a positive amount");
        }
        return recordLedgerEntry(userId, reason, points, bookingId, openGameId, null, note);
    }

    /**
     * Credits booking points at the loyalty program rate of ৳1 spent = 1 point:
     * the award is the booking's net amount rounded to whole taka. Bookings are
     * the biggest source of points, so this must never silently drop below the
     * positive floor {@link #earnPoints} enforces.
     */
    @Transactional
    public PointLedgerEntry awardBookingPoints(Long userId, Long bookingId, BigDecimal netAmount) {
        if (netAmount == null || netAmount.signum() <= 0) {
            throw new IllegalArgumentException("Booking net amount must be positive");
        }
        int points = netAmount.setScale(0, java.math.RoundingMode.HALF_UP).intValue();
        return earnPoints(userId, PointReason.BOOKING, points, bookingId, null, "Booked a turf");
    }

    /** +30 pts for attending and playing a booked match. */
    @Transactional
    public PointLedgerEntry awardMatchAttendedPoints(Long userId, Long bookingId) {
        return earnPoints(userId, PointReason.ATTENDED_MATCH, PointReason.ATTENDED_MATCH.defaultPoints(), bookingId, null,
                "Attended & played your match");
    }

    /** +20 pts for leaving a post-booking review. */
    @Transactional
    public PointLedgerEntry awardReviewPoints(Long userId, Long bookingId) {
        return earnPoints(userId, PointReason.REVIEW, PointReason.REVIEW.defaultPoints(), bookingId, null,
                "Left a review after a match");
    }

    /**
     * +10 pts for completing a profile, once per user. Returns empty (and
     * writes nothing) if this user has already been awarded the bonus.
     */
    @Transactional
    public Optional<PointLedgerEntry> awardProfileCompletionPointsOnce(Long userId) {
        if (pointLedgerRepository.existsByUserIdAndReason(userId, PointReason.PROFILE_COMPLETION)) {
            return Optional.empty();
        }
        return Optional.of(earnPoints(userId, PointReason.PROFILE_COMPLETION, PointReason.PROFILE_COMPLETION.defaultPoints(),
                null, null, "Completed your profile"));
    }

    /** +15 pts for joining an open game as a solo player. */
    @Transactional
    public PointLedgerEntry awardOpenGameJoinedPoints(Long userId, Long openGameId) {
        return earnPoints(userId, PointReason.JOINED_OPEN_GAME, PointReason.JOINED_OPEN_GAME.defaultPoints(), null, openGameId,
                "Joined an open game as a solo");
    }

    /**
     * +10 pts off-peak booking bonus, awarded only when the slot's start
     * time falls in the off-peak window. Returns empty (no ledger write)
     * for peak-hour bookings.
     */
    @Transactional
    public Optional<PointLedgerEntry> awardOffPeakBonusIfApplicable(Long userId, Long bookingId, LocalTime slotStartTime) {
        if (!isOffPeak(slotStartTime)) {
            return Optional.empty();
        }
        return Optional.of(earnPoints(userId, PointReason.OFF_PEAK_BONUS, PointReason.OFF_PEAK_BONUS.defaultPoints(), bookingId,
                null, "Booked an off-peak slot"));
    }

    /** Whether a slot starting at {@code startTime} qualifies for the off-peak bonus. */
    public boolean isOffPeak(LocalTime startTime) {
        return startTime != null && !startTime.isBefore(OFF_PEAK_START) && startTime.isBefore(OFF_PEAK_END);
    }

    /** Variable-amount monthly activity bonus (e.g. "5th booking this month"). */
    @Transactional
    public PointLedgerEntry awardMonthlyActivityBonus(Long userId, int points, String note) {
        return earnPoints(userId, PointReason.MONTHLY_BONUS, points, null, null, note != null ? note : "Monthly activity bonus");
    }

    private PointLedgerEntry recordLedgerEntry(Long userId, PointReason reason, int delta, Long bookingId, Long openGameId,
            Long rewardId, String note) {
        if (userId == null) {
            throw new IllegalArgumentException("userId is required");
        }
        int newBalance = currentBalance(userId) + delta;
        if (newBalance < 0) {
            throw new IllegalStateException("Insufficient points balance");
        }
        PointLedgerEntry entry = PointLedgerEntry.builder()
                .userId(userId)
                .delta(delta)
                .reason(reason)
                .referenceBookingId(bookingId)
                .referenceOpenGameId(openGameId)
                .referenceRewardId(rewardId)
                .balanceAfter(newBalance)
                .note(note)
                .build();
        return pointLedgerRepository.save(entry);
    }

    private int currentBalance(Long userId) {
        return pointLedgerRepository.sumDeltaByUserId(userId);
    }

    // ── Reading ──────────────────────────────────────────────────────────

    /** Balance, wallet balance, current/next tier, and progress toward the next tier. */
    @Transactional(readOnly = true)
    public PointsSummaryResponse getMyPoints(Long userId) {
        int balance = currentBalance(userId);
        List<LoyaltyTier> tiers = loyaltyTierRepository.findAllByOrderBySortOrderAsc();
        if (tiers.isEmpty()) {
            throw new IllegalStateException("Loyalty tiers are not configured");
        }

        LoyaltyTier current = tiers.get(0);
        for (LoyaltyTier tier : tiers) {
            if (balance >= tier.getMinPoints()) {
                current = tier;
            } else {
                break;
            }
        }

        int currentIndex = tiers.indexOf(current);
        LoyaltyTier next = currentIndex + 1 < tiers.size() ? tiers.get(currentIndex + 1) : null;

        Integer pointsToNextTier = null;
        Integer progressPercent = null;
        if (next != null) {
            pointsToNextTier = Math.max(0, next.getMinPoints() - balance);
            int span = next.getMinPoints() - current.getMinPoints();
            int rawProgress = span <= 0 ? 100 : (int) Math.round(100.0 * (balance - current.getMinPoints()) / span);
            progressPercent = Math.max(0, Math.min(100, rawProgress));
        }

        BigDecimal walletBalance = walletTransactionRepository.sumDeltaByUserId(userId);

        return PointsSummaryResponse.builder()
                .balance(balance)
                .walletBalance(walletBalance)
                .currentTier(toTierResponse(current))
                .nextTier(next != null ? toTierResponse(next) : null)
                .pointsToNextTier(pointsToNextTier)
                .progressPercent(progressPercent)
                .build();
    }

    /** Active reward catalog, annotated with whether the caller can currently afford each one. */
    @Transactional(readOnly = true)
    public List<RewardProductResponse> listRewardProducts(Long userId) {
        int balance = userId != null ? currentBalance(userId) : 0; // visitors browse the catalog with no balance
        return rewardProductRepository.findByIsActiveTrueOrderByCostPointsAsc().stream()
                .map(product -> RewardProductResponse.builder()
                        .id(product.getId())
                        .name(product.getName())
                        .description(product.getDescription())
                        .kind(product.getKind())
                        .costPoints(product.getCostPoints())
                        .value(product.getValue())
                        .locked(balance < product.getCostPoints())
                        .pointsToUnlock(Math.max(0, product.getCostPoints() - balance))
                        .build())
                .toList();
    }

    /** Most recent ledger entries for the "recent points activity" feed. */
    @Transactional(readOnly = true)
    public List<PointActivityResponse> getRecentActivity(Long userId, int limit) {
        int pageSize = limit > 0 ? limit : DEFAULT_ACTIVITY_LIMIT;
        return pointLedgerRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, pageSize)).stream()
                .map(entry -> PointActivityResponse.builder()
                        .id(entry.getId())
                        .delta(entry.getDelta())
                        .reason(entry.getReason())
                        .note(entry.getNote())
                        .balanceAfter(entry.getBalanceAfter())
                        .createdAt(entry.getCreatedAt())
                        .build())
                .toList();
    }

    private TierResponse toTierResponse(LoyaltyTier tier) {
        return TierResponse.builder()
                .name(tier.getName())
                .minPoints(tier.getMinPoints())
                .discountPercent(tier.getDiscountPercent())
                .perks(tier.getPerks())
                .build();
    }

    // ── Redeeming ────────────────────────────────────────────────────────

    /**
     * Redeems a reward: debits the point ledger, records the redemption,
     * and — for {@link RewardKind#WALLET_CREDIT} rewards — immediately
     * credits the wallet (matching the "no code to copy, applied at
     * checkout" behavior on the rewards page). Other reward kinds are left
     * {@code ISSUED} for the checkout flow to apply later.
     */
    @Transactional
    public RedemptionResponse redeem(Long userId, Long rewardProductId) {
        RewardProduct product = rewardProductRepository.findById(rewardProductId)
                .orElseThrow(() -> new IllegalArgumentException("Reward not found with id: " + rewardProductId));

        if (!Boolean.TRUE.equals(product.getIsActive())) {
            throw new IllegalStateException("This reward is no longer available");
        }

        PointLedgerEntry debit = recordLedgerEntry(userId, PointReason.REDEMPTION, -product.getCostPoints(), null, null,
                product.getId(), "Redeemed: " + product.getName());

        RewardRedemption redemption = rewardRedemptionRepository.save(RewardRedemption.builder()
                .userId(userId)
                .rewardId(product.getId())
                .costPoints(product.getCostPoints())
                .status(RedemptionStatus.ISSUED)
                .build());

        BigDecimal walletCreditAmount = null;
        BigDecimal newWalletBalance = null;
        if (product.getKind() == RewardKind.WALLET_CREDIT) {
            walletCreditAmount = product.getValue() != null ? product.getValue() : BigDecimal.ZERO;
            newWalletBalance = creditWallet(userId, walletCreditAmount, redemption.getId());
            redemption.setStatus(RedemptionStatus.APPLIED);
            redemption.setWalletCreditAmount(walletCreditAmount);
            redemption = rewardRedemptionRepository.save(redemption);
        }

        return RedemptionResponse.builder()
                .redemptionId(redemption.getId())
                .rewardName(product.getName())
                .pointsSpent(product.getCostPoints())
                .newBalance(debit.getBalanceAfter())
                .status(redemption.getStatus())
                .walletCreditAmount(walletCreditAmount)
                .newWalletBalance(newWalletBalance)
                .build();
    }

    /** The caller's current wallet balance — the running sum of {@code wallet_transactions}. */
    @Transactional(readOnly = true)
    public BigDecimal getWalletBalance(Long userId) {
        return walletTransactionRepository.sumDeltaByUserId(userId);
    }

    /**
     * Applies (spends) wallet balance toward a booking's payment at
     * checkout. The payment/checkout module is the only caller of this —
     * see {@link com.turfchai.reward.entity.WalletTransaction}'s Javadoc,
     * which reserves {@link WalletReason#CHECKOUT_APPLY} for exactly this.
     */
    @Transactional
    public BigDecimal applyWalletAtCheckout(Long userId, BigDecimal amount, Long bookingId) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Wallet amount to apply must be positive");
        }
        BigDecimal balance = getWalletBalance(userId);
        if (amount.compareTo(balance) > 0) {
            throw new IllegalStateException("Insufficient wallet balance");
        }
        BigDecimal newBalance = balance.subtract(amount);
        walletTransactionRepository.save(WalletTransaction.builder()
                .userId(userId)
                .delta(amount.negate())
                .reason(WalletReason.CHECKOUT_APPLY)
                .bookingId(bookingId)
                .balanceAfter(newBalance)
                .build());
        return newBalance;
    }

    private BigDecimal creditWallet(Long userId, BigDecimal amount, Long redemptionId) {
        BigDecimal newBalance = walletTransactionRepository.sumDeltaByUserId(userId).add(amount);
        walletTransactionRepository.save(WalletTransaction.builder()
                .userId(userId)
                .delta(amount)
                .reason(WalletReason.REWARD_CREDIT)
                .redemptionId(redemptionId)
                .balanceAfter(newBalance)
                .build());
        return newBalance;
    }
}
