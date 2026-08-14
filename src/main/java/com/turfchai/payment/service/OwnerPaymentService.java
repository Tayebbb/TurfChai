package com.turfchai.payment.service;

import com.turfchai.model.Payout;
import com.turfchai.payment.dto.OwnerPaymentSummaryDto;
import com.turfchai.repository.PayoutRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OwnerPaymentService {

    private final PayoutRepository payoutRepository;

    @Transactional(readOnly = true)
    public OwnerPaymentSummaryDto getOwnerPaymentSummary(Long ownerUserId) {
        List<Payout> ownerPayouts = payoutRepository.findByOwnerUserIdOrderByCreatedAtDesc(ownerUserId);

        BigDecimal grossToday = new BigDecimal("19750");
        BigDecimal platformFees = new BigDecimal("1185");
        BigDecimal refunds = new BigDecimal("2200");
        BigDecimal netToYou = grossToday.subtract(platformFees).subtract(refunds);

        OwnerPaymentSummaryDto.Kpis kpis = OwnerPaymentSummaryDto.Kpis.builder()
                .grossToday("৳" + String.format("%,d", grossToday.longValue()))
                .platformFees("−৳" + String.format("%,d", platformFees.longValue()))
                .refunds("−৳" + String.format("%,d", refunds.longValue()))
                .netToYou("৳" + String.format("%,d", netToYou.longValue()))
                .deltaInfo("14 transactions today")
                .nextSettlementDate("Settles Mon 11 Aug")
                .build();

        List<OwnerPaymentSummaryDto.LedgerRow> ledger = new ArrayList<>();
        ledger.add(OwnerPaymentSummaryDto.LedgerRow.builder()
                .id("tc-48291")
                .time("6:12 PM")
                .booking("TC-48291")
                .customer("Rafiul Karim")
                .method("bKash · ")
                .txn("8H2K19")
                .gross("৳2,550")
                .fee("−৳153")
                .net("৳2,397")
                .statusTone("green")
                .statusText("Reconciled ✓")
                .shift("Evening · Online")
                .isRefund(false)
                .build());

        ledger.add(OwnerPaymentSummaryDto.LedgerRow.builder()
                .id("og-7734")
                .time("5:47 PM")
                .booking("OG-7734")
                .customer("Open game (10 shares)")
                .method("bKash / Nagad mix")
                .txn("MIX-773")
                .gross("৳2,800")
                .fee("−৳168")
                .net("৳2,632")
                .statusTone("green")
                .statusText("Reconciled ✓")
                .shift("Evening · Online")
                .isRefund(false)
                .build());

        ledger.add(OwnerPaymentSummaryDto.LedgerRow.builder()
                .id("tc-48277")
                .time("4:02 PM")
                .booking("TC-48277")
                .customer("Tanvir Ahmed")
                .method("Card · Visa •••4412")
                .txn("V-4412")
                .gross("৳2,500")
                .fee("−৳150")
                .net("৳2,350")
                .statusTone("green")
                .statusText("Reconciled ✓")
                .shift("Evening · Online")
                .isRefund(false)
                .build());

        ledger.add(OwnerPaymentSummaryDto.LedgerRow.builder()
                .id("tc-48288")
                .time("3:05 PM")
                .booking("TC-48288")
                .customer("Walk-in customer")
                .method("Cash")
                .txn("CASH")
                .gross("৳1,700")
                .fee("—")
                .net("৳1,700")
                .statusTone("green")
                .statusText("Logged by Sumon")
                .shift("Afternoon · Walk-in")
                .isRefund(false)
                .build());

        ledger.add(OwnerPaymentSummaryDto.LedgerRow.builder()
                .id("tc-48285")
                .time("1:22 PM")
                .booking("TC-48285")
                .customer("Karim Traders XI")
                .method("Nagad · ")
                .txn("N7761")
                .gross("৳765")
                .fee("−৳46")
                .net("৳719")
                .statusTone("amber")
                .statusText("Deposit · ৳1,785 due")
                .shift("Afternoon · Phone")
                .isRefund(false)
                .build());

        ledger.add(OwnerPaymentSummaryDto.LedgerRow.builder()
                .id("tc-48102")
                .time("11:40 AM")
                .booking("TC-48102")
                .customer("Sadia Rahman")
                .method("bKash refund · ")
                .txn("R-2210")
                .gross("−৳2,200")
                .fee("+৳132")
                .net("−৳2,068")
                .statusTone("blue")
                .statusText("Refund sent")
                .shift("Morning · Online")
                .isRefund(true)
                .build());

        OwnerPaymentSummaryDto.Reconciliation reconciliation = OwnerPaymentSummaryDto.Reconciliation.builder()
                .onlineAmount("৳7,850 · auto-matched ✓")
                .cashCollected("৳1,700")
                .depositsOutstanding("৳4,300")
                .unmatchedIncoming("৳1,700 (1)")
                .unmatchedCount(1)
                .isBalanced(true)
                .build();

        List<OwnerPaymentSummaryDto.MethodSplitRow> methodSplit = List.of(
                OwnerPaymentSummaryDto.MethodSplitRow.builder().id("bkash").label("bKash").value("54% · ৳2,41,300").width("54%").color("var(--brand-500)").build(),
                OwnerPaymentSummaryDto.MethodSplitRow.builder().id("cash").label("Cash").value("21% · ৳93,800").width("21%").color("var(--info)").build(),
                OwnerPaymentSummaryDto.MethodSplitRow.builder().id("nagad").label("Nagad").value("15% · ৳67,000").width("15%").color("var(--warn)").build(),
                OwnerPaymentSummaryDto.MethodSplitRow.builder().id("card").label("Card").value("10% · ৳44,700").width("10%").color("#8B5CF6").build()
        );

        List<OwnerPaymentSummaryDto.SportReportRow> sportReport = List.of(
                OwnerPaymentSummaryDto.SportReportRow.builder()
                        .sport("Football")
                        .title("⚽ Football")
                        .occText("88% Occ.")
                        .occTone("blue")
                        .booked("42 slots · ৳92,400")
                        .missed("5 slots · −৳11,000")
                        .missedCount("5 slots")
                        .missedLoss("৳11,000")
                        .barWidth("88%")
                        .barBackground("var(--brand-500)")
                        .items(List.of("Tue 2:00–3:30 PM (Off-peak unbooked)", "Wed 10:00–11:30 AM (Rainy morning)", "Thu 4:00–5:30 PM (Late cancellation)"))
                        .build(),
                OwnerPaymentSummaryDto.SportReportRow.builder()
                        .sport("Cricket")
                        .title("🏏 Cricket")
                        .occText("94% Occ.")
                        .occTone("amber")
                        .booked("16 slots · ৳48,000")
                        .missed("1 slot · −৳3,000")
                        .missedCount("1 slot")
                        .missedLoss("৳3,000")
                        .barWidth("94%")
                        .barBackground("var(--warn)")
                        .items(List.of("Monday 10:00 AM–12:00 PM (Off-peak weekday)"))
                        .build()
        );

        return OwnerPaymentSummaryDto.builder()
                .kpis(kpis)
                .ledger(ledger)
                .reconciliation(reconciliation)
                .methodSplit(methodSplit)
                .sportReport(sportReport)
                .build();
    }

    public String generateCsvExport(Long ownerUserId) {
        StringBuilder csv = new StringBuilder();
        csv.append("Time,Booking,Customer,Method,Txn,Gross,Fee,Net,Status,Shift\n");
        csv.append("6:12 PM,TC-48291,Rafiul Karim,bKash,8H2K19,2550,-153,2397,Reconciled,Evening Online\n");
        csv.append("5:47 PM,OG-7734,Open Game,bKash/Nagad,MIX-773,2800,-168,2632,Reconciled,Evening Online\n");
        csv.append("4:02 PM,TC-48277,Tanvir Ahmed,Card,V-4412,2500,-150,2350,Reconciled,Evening Online\n");
        csv.append("3:05 PM,TC-48288,Walk-in Customer,Cash,CASH,1700,0,1700,Logged by Sumon,Afternoon Walk-in\n");
        csv.append("1:22 PM,TC-48285,Karim Traders XI,Nagad,N7761,765,-46,719,Deposit,Afternoon Phone\n");
        return csv.toString();
    }

    public String generateInvoiceHtml(String payoutCode) {
        Payout payout = payoutRepository.findByPayoutCode(payoutCode).orElse(null);
        String dateStr = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);
        String grossStr = payout != null ? payout.getGrossAmount().toString() : "48,220.00";
        String netStr = payout != null ? payout.getNetAmount().toString() : "45,326.80";
        String feeStr = payout != null ? payout.getPlatformFee().toString() : "2,893.20";

        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8"/>
                    <title>TurfChai Settlement Invoice - %s</title>
                    <style>
                        body { font-family: sans-serif; padding: 30px; color: #111; }
                        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #22c55e; padding-bottom: 15px; }
                        .title { font-size: 24px; font-weight: bold; color: #166534; }
                        .table { width: 100%%; margin-top: 20px; border-collapse: collapse; }
                        .table th, .table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                        .table th { background: #f0fdf4; }
                        .total { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="title">TurfChai Payout Invoice</div>
                            <div>Reference: %s</div>
                            <div>Date: %s</div>
                        </div>
                        <div>
                            <b>TurfChai Bangladesh</b><br/>
                            Dhaka, Bangladesh
                        </div>
                    </div>
                    <table class="table">
                        <thead>
                            <tr><th>Description</th><th>Amount (BDT)</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Gross Online Bookings Revenue</td><td>৳%s</td></tr>
                            <tr><td>Platform Commission (-6%%)</td><td>-৳%s</td></tr>
                            <tr><td><b>Net Settlement Payout</b></td><td><b>৳%s</b></td></tr>
                        </tbody>
                    </table>
                    <div class="total">Total Paid: ৳%s BDT</div>
                </body>
                </html>
                """.formatted(payoutCode, payoutCode, dateStr, grossStr, feeStr, netStr, netStr);
    }
}
