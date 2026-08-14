package com.turfchai.payment.api;

import com.turfchai.payment.dto.OwnerPaymentSummaryDto;
import com.turfchai.payment.service.OwnerPaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/owner/payments")
@RequiredArgsConstructor
public class OwnerPaymentRestController {

    private final OwnerPaymentService paymentService;

    @GetMapping
    public ResponseEntity<OwnerPaymentSummaryDto> getPaymentSummary(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        Long ownerId = 1L;
        return ResponseEntity.ok(paymentService.getOwnerPaymentSummary(ownerId));
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<String> exportCsv(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        Long ownerId = 1L;
        String csvData = paymentService.generateCsvExport(ownerId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"payments-export.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csvData);
    }

    @GetMapping(value = "/invoices/{payoutCode}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> downloadInvoice(@PathVariable String payoutCode) {
        String invoiceHtml = paymentService.generateInvoiceHtml(payoutCode);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"invoice-" + payoutCode + ".html\"")
                .body(invoiceHtml);
    }

    @PostMapping("/close-shift")
    public ResponseEntity<Map<String, Object>> closeShift() {
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Evening shift closed successfully. Ledger balanced."
        ));
    }
}
