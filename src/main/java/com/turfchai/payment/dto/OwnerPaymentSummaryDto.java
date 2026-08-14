package com.turfchai.payment.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OwnerPaymentSummaryDto {

    private Kpis kpis;
    private List<LedgerRow> ledger;
    private Reconciliation reconciliation;
    private List<MethodSplitRow> methodSplit;
    private List<SportReportRow> sportReport;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Kpis {
        private String grossToday;
        private String platformFees;
        private String refunds;
        private String netToYou;
        private String deltaInfo;
        private String nextSettlementDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LedgerRow {
        private String id;
        private String time;
        private String booking;
        private String customer;
        private String method;
        private String txn;
        private String gross;
        private String fee;
        private String net;
        private String statusTone;
        private String statusText;
        private String shift;
        private Boolean isRefund;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Reconciliation {
        private String onlineAmount;
        private String cashCollected;
        private String depositsOutstanding;
        private String unmatchedIncoming;
        private Integer unmatchedCount;
        private Boolean isBalanced;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MethodSplitRow {
        private String id;
        private String label;
        private String value;
        private String width;
        private String color;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SportReportRow {
        private String sport;
        private String title;
        private String occText;
        private String occTone;
        private String booked;
        private String missed;
        private String missedCount;
        private String missedLoss;
        private String barWidth;
        private String barBackground;
        private List<String> items;
    }
}
