package com.turfchai.payment.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class RefundCalculatorServiceTest {

    private final RefundCalculatorService service = new RefundCalculatorService();

    @ParameterizedTest(name = "FREE_24H_50_6H at {0}h -> {1}%")
    @CsvSource({
            "30, 100",
            "24, 100",
            "23.9, 50",
            "6, 50",
            "5.9, 0",
            "0, 0",
    })
    @DisplayName("Standard policy: >=24h full, 6-24h half, <6h none")
    void standardPolicy(double hours, int expectedPercent) {
        assertEquals(expectedPercent, service.calculateRefundPercent(RefundCalculatorService.FREE_24H_50_6H, hours));
    }

    @ParameterizedTest(name = "FLEXIBLE_6H at {0}h -> {1}%")
    @CsvSource({
            "24, 100",
            "6, 100",
            "5.9, 0",
            "0, 0",
    })
    @DisplayName("Flexible policy: >=6h full, otherwise none")
    void flexiblePolicy(double hours, int expectedPercent) {
        assertEquals(expectedPercent, service.calculateRefundPercent(RefundCalculatorService.FLEXIBLE_6H, hours));
    }

    @ParameterizedTest(name = "STRICT_NO_REFUND at {0}h -> 0%")
    @CsvSource({ "48", "24", "6", "1", "0" })
    @DisplayName("Strict policy: never refunds, regardless of timing")
    void strictPolicy(double hours) {
        assertEquals(0, service.calculateRefundPercent(RefundCalculatorService.STRICT_NO_REFUND, hours));
    }

    @Test
    @DisplayName("A slot that has already started (negative hours) never refunds, under any policy")
    void pastSlot_neverRefunds() {
        assertEquals(0, service.calculateRefundPercent(RefundCalculatorService.FREE_24H_50_6H, -1));
        assertEquals(0, service.calculateRefundPercent(RefundCalculatorService.FLEXIBLE_6H, -1));
    }

    @Test
    @DisplayName("An unrecognized/null policy falls back to the standard tiers")
    void unknownPolicy_fallsBackToStandard() {
        assertEquals(100, service.calculateRefundPercent(null, 30));
        assertEquals(50, service.calculateRefundPercent("SOMETHING_ELSE", 10));
    }
}
