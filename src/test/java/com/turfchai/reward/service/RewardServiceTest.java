package com.turfchai.reward.service;

import com.turfchai.reward.dto.response.PointsSummaryResponse;
import com.turfchai.reward.dto.response.RedemptionResponse;
import com.turfchai.reward.dto.response.RewardProductResponse;
import com.turfchai.reward.entity.LoyaltyTier;
import com.turfchai.reward.entity.PointLedgerEntry;
import com.turfchai.reward.entity.PointReason;
import com.turfchai.reward.entity.RedemptionStatus;
import com.turfchai.reward.entity.RewardKind;
import com.turfchai.reward.entity.RewardProduct;
import com.turfchai.reward.entity.RewardRedemption;
import com.turfchai.reward.repository.LoyaltyTierRepository;
import com.turfchai.reward.repository.PointLedgerRepository;
import com.turfchai.reward.repository.RewardProductRepository;
import com.turfchai.reward.repository.RewardRedemptionRepository;
import com.turfchai.reward.repository.WalletTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RewardServiceTest {

    @Mock
    private PointLedgerRepository pointLedgerRepository;
    @Mock
    private LoyaltyTierRepository loyaltyTierRepository;
    @Mock
    private RewardProductRepository rewardProductRepository;
    @Mock
    private RewardRedemptionRepository rewardRedemptionRepository;
    @Mock
    private WalletTransactionRepository walletTransactionRepository;

    @InjectMocks
    private RewardService rewardService;

    private static final Long USER_ID = 42L;

    private LoyaltyTier silver;
    private LoyaltyTier gold;
    private LoyaltyTier platinum;

    @BeforeEach
    void setUp() {
        silver = LoyaltyTier.builder().id(1L).name("SILVER").minPoints(0)
                .discountPercent(BigDecimal.ZERO).perks(Map.of()).sortOrder((short) 1).build();
        gold = LoyaltyTier.builder().id(2L).name("GOLD").minPoints(1000)
                .discountPercent(BigDecimal.valueOf(10)).perks(Map.of()).sortOrder((short) 2).build();
        platinum = LoyaltyTier.builder().id(3L).name("PLATINUM").minPoints(2000)
                .discountPercent(BigDecimal.valueOf(15)).perks(Map.of()).sortOrder((short) 3).build();
    }

    // ── Earning ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("awardBookingPoints writes a +50 ledger entry with a correct running balance")
    void awardBookingPoints_writesLedgerEntryWithRunningBalance() {
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(200);
        when(pointLedgerRepository.save(any(PointLedgerEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        PointLedgerEntry entry = rewardService.awardBookingPoints(USER_ID, 99L);

        assertEquals(50, entry.getDelta());
        assertEquals(PointReason.BOOKING, entry.getReason());
        assertEquals(99L, entry.getReferenceBookingId());
        assertEquals(250, entry.getBalanceAfter());
    }

    @Test
    @DisplayName("awardProfileCompletionPointsOnce is a no-op the second time it's called for the same user")
    void awardProfileCompletionPointsOnce_isIdempotent() {
        when(pointLedgerRepository.existsByUserIdAndReason(USER_ID, PointReason.PROFILE_COMPLETION)).thenReturn(true);

        Optional<PointLedgerEntry> result = rewardService.awardProfileCompletionPointsOnce(USER_ID);

        assertTrue(result.isEmpty());
        verify(pointLedgerRepository, never()).save(any());
    }

    @Test
    @DisplayName("awardOffPeakBonusIfApplicable credits points for a morning slot")
    void awardOffPeakBonus_appliesForOffPeakSlot() {
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(0);
        when(pointLedgerRepository.save(any(PointLedgerEntry.class))).thenAnswer(inv -> inv.getArgument(0));

        Optional<PointLedgerEntry> result = rewardService.awardOffPeakBonusIfApplicable(USER_ID, 5L, LocalTime.of(9, 0));

        assertTrue(result.isPresent());
        assertEquals(10, result.get().getDelta());
        assertEquals(PointReason.OFF_PEAK_BONUS, result.get().getReason());
    }

    @Test
    @DisplayName("awardOffPeakBonusIfApplicable does not credit points for an evening slot")
    void awardOffPeakBonus_skipsForPeakSlot() {
        Optional<PointLedgerEntry> result = rewardService.awardOffPeakBonusIfApplicable(USER_ID, 5L, LocalTime.of(19, 0));

        assertTrue(result.isEmpty());
        verify(pointLedgerRepository, never()).save(any());
    }

    @Test
    @DisplayName("earnPoints rejects a non-positive award")
    void earnPoints_rejectsNonPositiveAmount() {
        assertThrows(IllegalArgumentException.class,
                () -> rewardService.earnPoints(USER_ID, PointReason.MONTHLY_BONUS, 0, null, null, "bad"));
        verify(pointLedgerRepository, never()).save(any());
    }

    // ── my-points / tier calculation ────────────────────────────────────

    @Test
    @DisplayName("getMyPoints resolves the GOLD tier and progress toward PLATINUM")
    void getMyPoints_resolvesGoldTierWithProgress() {
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(1240);
        when(loyaltyTierRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(silver, gold, platinum));
        when(walletTransactionRepository.sumDeltaByUserId(USER_ID)).thenReturn(BigDecimal.ZERO);

        PointsSummaryResponse summary = rewardService.getMyPoints(USER_ID);

        assertEquals(1240, summary.getBalance());
        assertEquals("GOLD", summary.getCurrentTier().getName());
        assertEquals("PLATINUM", summary.getNextTier().getName());
        assertEquals(760, summary.getPointsToNextTier());
        assertEquals(24, summary.getProgressPercent());
    }

    @Test
    @DisplayName("getMyPoints has no next tier once the caller is at the top tier")
    void getMyPoints_topTierHasNoNextTier() {
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(3000);
        when(loyaltyTierRepository.findAllByOrderBySortOrderAsc()).thenReturn(List.of(silver, gold, platinum));
        when(walletTransactionRepository.sumDeltaByUserId(USER_ID)).thenReturn(BigDecimal.ZERO);

        PointsSummaryResponse summary = rewardService.getMyPoints(USER_ID);

        assertEquals("PLATINUM", summary.getCurrentTier().getName());
        assertEquals(null, summary.getNextTier());
        assertEquals(null, summary.getPointsToNextTier());
    }

    // ── reward catalog ───────────────────────────────────────────────────

    @Test
    @DisplayName("listRewardProducts flags rewards the caller cannot yet afford as locked")
    void listRewardProducts_flagsLockedRewards() {
        RewardProduct affordable = RewardProduct.builder().id(1L).name("৳50 off").kind(RewardKind.WALLET_CREDIT)
                .costPoints(500).value(BigDecimal.valueOf(50)).isActive(true).build();
        RewardProduct locked = RewardProduct.builder().id(2L).name("Priority Booking Pass").kind(RewardKind.PRIORITY_PASS)
                .costPoints(3000).isActive(true).build();
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(1240);
        when(rewardProductRepository.findByIsActiveTrueOrderByCostPointsAsc()).thenReturn(List.of(affordable, locked));

        List<RewardProductResponse> products = rewardService.listRewardProducts(USER_ID);

        assertFalse(products.get(0).getLocked());
        assertEquals(0, products.get(0).getPointsToUnlock());
        assertTrue(products.get(1).getLocked());
        assertEquals(1760, products.get(1).getPointsToUnlock());
    }

    // ── redeem ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("redeem fails when the reward does not exist")
    void redeem_failsWhenRewardNotFound() {
        when(rewardProductRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> rewardService.redeem(USER_ID, 404L));
    }

    @Test
    @DisplayName("redeem fails when the reward is inactive")
    void redeem_failsWhenRewardInactive() {
        RewardProduct inactive = RewardProduct.builder().id(1L).name("Old reward").kind(RewardKind.WALLET_CREDIT)
                .costPoints(500).isActive(false).build();
        when(rewardProductRepository.findById(1L)).thenReturn(Optional.of(inactive));

        assertThrows(IllegalStateException.class, () -> rewardService.redeem(USER_ID, 1L));
        verify(pointLedgerRepository, never()).save(any());
    }

    @Test
    @DisplayName("redeem fails when the caller's point balance is insufficient")
    void redeem_failsWhenInsufficientBalance() {
        RewardProduct product = RewardProduct.builder().id(1L).name("Free 1-hr slot").kind(RewardKind.FREE_SLOT)
                .costPoints(2000).isActive(true).build();
        when(rewardProductRepository.findById(1L)).thenReturn(Optional.of(product));
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(500);

        assertThrows(IllegalStateException.class, () -> rewardService.redeem(USER_ID, 1L));
        verify(pointLedgerRepository, never()).save(any());
        verify(rewardRedemptionRepository, never()).save(any());
    }

    @Test
    @DisplayName("redeem of a WALLET_CREDIT reward debits points and credits the wallet atomically")
    void redeem_walletCreditReward_creditsWalletImmediately() {
        RewardProduct product = RewardProduct.builder().id(1L).name("৳50 off").kind(RewardKind.WALLET_CREDIT)
                .costPoints(500).value(BigDecimal.valueOf(50)).isActive(true).build();
        when(rewardProductRepository.findById(1L)).thenReturn(Optional.of(product));
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(1240);
        when(pointLedgerRepository.save(any(PointLedgerEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(rewardRedemptionRepository.save(any(RewardRedemption.class))).thenAnswer(inv -> {
            RewardRedemption redemption = inv.getArgument(0);
            if (redemption.getId() == null) {
                redemption.setId(7L);
            }
            return redemption;
        });
        when(walletTransactionRepository.sumDeltaByUserId(USER_ID)).thenReturn(BigDecimal.valueOf(100));

        RedemptionResponse response = rewardService.redeem(USER_ID, 1L);

        assertEquals(7L, response.getRedemptionId());
        assertEquals(500, response.getPointsSpent());
        assertEquals(740, response.getNewBalance());
        assertEquals(RedemptionStatus.APPLIED, response.getStatus());
        assertEquals(BigDecimal.valueOf(50), response.getWalletCreditAmount());
        assertEquals(BigDecimal.valueOf(150), response.getNewWalletBalance());

        ArgumentCaptor<PointLedgerEntry> ledgerCaptor = ArgumentCaptor.forClass(PointLedgerEntry.class);
        verify(pointLedgerRepository).save(ledgerCaptor.capture());
        assertEquals(-500, ledgerCaptor.getValue().getDelta());
        assertEquals(PointReason.REDEMPTION, ledgerCaptor.getValue().getReason());
        assertEquals(1L, ledgerCaptor.getValue().getReferenceRewardId());

        verify(rewardRedemptionRepository, times(2)).save(any(RewardRedemption.class));
    }

    @Test
    @DisplayName("redeem of a non-wallet reward is left ISSUED for later checkout application")
    void redeem_nonWalletReward_staysIssued() {
        RewardProduct product = RewardProduct.builder().id(2L).name("Priority Booking Pass").kind(RewardKind.PRIORITY_PASS)
                .costPoints(3000).isActive(true).build();
        when(rewardProductRepository.findById(2L)).thenReturn(Optional.of(product));
        when(pointLedgerRepository.sumDeltaByUserId(USER_ID)).thenReturn(3200);
        when(pointLedgerRepository.save(any(PointLedgerEntry.class))).thenAnswer(inv -> inv.getArgument(0));
        when(rewardRedemptionRepository.save(any(RewardRedemption.class))).thenAnswer(inv -> inv.getArgument(0));

        RedemptionResponse response = rewardService.redeem(USER_ID, 2L);

        assertEquals(RedemptionStatus.ISSUED, response.getStatus());
        assertEquals(null, response.getWalletCreditAmount());
        verify(walletTransactionRepository, never()).save(any());
        verify(rewardRedemptionRepository, times(1)).save(any(RewardRedemption.class));
    }
}
