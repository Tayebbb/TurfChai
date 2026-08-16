package com.turfchai.booking.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.lowagie.text.Chunk;
import com.lowagie.text.Document;
import com.lowagie.text.DocumentException;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.Image;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.turfchai.booking.dto.response.BookingResponse;
import com.turfchai.payment.dto.response.PaymentResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Renders a booking as a downloadable PDF receipt/ticket: the same match
 * details, price breakdown, and transaction history {@code BookingDetailPage}
 * shows on screen, plus a scannable QR that deep-links back to the booking.
 *
 * <p>
 * Deliberately takes the same DTOs the REST layer already returns
 * ({@link BookingResponse}, {@link PaymentResponse}) rather than raw entities
 * — the math here (paid / refunded / still due) mirrors what the frontend
 * already computes from those same DTOs, so the two must never see different
 * shapes of the same data.
 */
@Service
public class BookingPdfService {

    private static final Color BRAND_GREEN = new Color(14, 122, 74);
    private static final Color MUTED_GRAY = new Color(89, 108, 98);
    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a", Locale.ENGLISH);

    private final String frontendUrl;

    public BookingPdfService(
            @Value("${app.cors.frontend-url:${FRONTEND_URL:http://localhost:5173}}") String frontendUrl) {
        // Multiple comma-separated origins are allowed (see WebCorsConfig); the
        // first is the canonical one to build a real link out of.
        this.frontendUrl = Arrays.stream(frontendUrl.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .findFirst()
                .orElse("http://localhost:5173");
    }

    public byte[] generate(BookingResponse booking, List<PaymentResponse> payments) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Document document = new Document(PageSize.A4, 36, 36, 54, 54);
            PdfWriter.getInstance(document, out);
            document.open();

            addHeader(document, booking);
            addMatchDetails(document, booking);
            addPriceBreakdown(document, booking);
            addTransactions(document, payments);
            addSummary(document, booking, payments);
            addQrCode(document, booking);
            addFooter(document);

            document.close();
            return out.toByteArray();
        } catch (DocumentException | IOException | WriterException e) {
            throw new IllegalStateException("Could not generate booking PDF", e);
        }
    }

    private void addHeader(Document document, BookingResponse booking) throws DocumentException {
        Font brand = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, BRAND_GREEN);
        Paragraph title = new Paragraph("TurfChai", brand);
        title.add(new Chunk("  ·  Booking receipt",
                FontFactory.getFont(FontFactory.HELVETICA, 12, MUTED_GRAY)));
        document.add(title);

        Font codeFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15);
        Paragraph code = new Paragraph("Booking " + safe(booking.getBookingCode()), codeFont);
        code.setSpacingBefore(10);
        document.add(code);

        Font statusFont = FontFactory.getFont(FontFactory.HELVETICA, 11, MUTED_GRAY);
        Paragraph status = new Paragraph("Status: " + safe(booking.getStatus()), statusFont);
        status.setSpacingAfter(14);
        document.add(status);
    }

    private void addMatchDetails(Document document, BookingResponse booking) throws DocumentException {
        addSectionTitle(document, "Match details");

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setSpacingAfter(16);

        addFactRow(table, "Venue", safe(booking.getVenueName()));
        addFactRow(table, "Address",
                joinNonBlank(", ", booking.getVenueAddress(), booking.getVenueArea()));
        addFactRow(table, "Pitch", safe(booking.getPitchName()));
        addFactRow(table, "Date", formatDate(booking.getBookingDate()));
        addFactRow(table, "Play time", formatTimeRange(booking.getStartTime(), booking.getEndTime()));
        addFactRow(table, "Arrive by", "10 min early");
        if (booking.getVenueContactPhone() != null && !booking.getVenueContactPhone().isBlank()) {
            addFactRow(table, "Venue contact", booking.getVenueContactPhone());
        }

        document.add(table);
    }

    private void addPriceBreakdown(Document document, BookingResponse booking) throws DocumentException {
        addSectionTitle(document, "Price breakdown");

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setSpacingAfter(16);

        addFactRow(table, "Slot price", bdt(booking.getAmount()));
        if (booking.getDiscountAmount() != null && booking.getDiscountAmount().signum() > 0) {
            String promoLabel = booking.getPromoCode() != null && !booking.getPromoCode().isBlank()
                    ? "Discount (" + booking.getPromoCode() + ")"
                    : "Discount";
            addFactRow(table, promoLabel, "-" + bdt(booking.getDiscountAmount()));
        }
        addFactRow(table, "Net amount", bdt(booking.getNetAmount()));

        document.add(table);
    }

    private void addTransactions(Document document, List<PaymentResponse> payments) throws DocumentException {
        addSectionTitle(document, "Transactions");

        if (payments == null || payments.isEmpty()) {
            document.add(new Paragraph("No payments recorded yet.",
                    FontFactory.getFont(FontFactory.HELVETICA, 10, MUTED_GRAY)));
            return;
        }

        PdfPTable table = new PdfPTable(new float[] { 2.2f, 2.4f, 1.6f, 1.6f, 1.6f });
        table.setWidthPercentage(100);
        table.setSpacingAfter(16);

        Font headFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
        for (String head : new String[] { "Date", "Detail", "Method", "Amount", "Status" }) {
            PdfPCell cell = new PdfPCell(new Paragraph(head, headFont));
            cell.setBackgroundColor(BRAND_GREEN);
            cell.setPadding(6);
            table.addCell(cell);
        }

        Font rowFont = FontFactory.getFont(FontFactory.HELVETICA, 9);
        for (PaymentResponse payment : payments) {
            boolean fromWallet = Boolean.TRUE.equals(payment.getFromWallet());
            boolean isRefund = payment.getType() != null && payment.getType().name().equals("REFUND");
            String detail = fromWallet
                    ? (isRefund ? "Refund to wallet" : "Wallet credit")
                    : (isRefund ? "Refund" : "Booking payment");
            String method = fromWallet ? "Wallet" : String.valueOf(payment.getMethod());
            String when = payment.getPaidAt() != null ? payment.getPaidAt().toLocalDate().toString()
                    : payment.getCreatedAt() != null ? payment.getCreatedAt().toLocalDate().toString() : "—";

            addBodyCell(table, when, rowFont);
            addBodyCell(table, detail, rowFont);
            addBodyCell(table, method, rowFont);
            addBodyCell(table, bdt(payment.getAmount()), rowFont);
            addBodyCell(table, String.valueOf(payment.getStatus()), rowFont);
        }

        document.add(table);
    }

    private void addSummary(Document document, BookingResponse booking, List<PaymentResponse> payments)
            throws DocumentException {
        addSectionTitle(document, "Summary");

        List<PaymentResponse> safePayments = payments == null ? List.of() : payments;
        BigDecimal settledTotal = safePayments.stream()
                .filter(p -> p.getType() != null && p.getType().name().equals("BOOKING")
                        && p.getStatus() != null && !p.getStatus().name().equals("FAILED"))
                .map(PaymentResponse::getAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refundedTotal = safePayments.stream()
                .filter(p -> p.getType() != null && p.getType().name().equals("REFUND")
                        && p.getStatus() != null && !p.getStatus().name().equals("FAILED"))
                .map(PaymentResponse::getAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netPaid = settledTotal.subtract(refundedTotal);
        boolean cancelled = "CANCELLED".equals(booking.getStatus());
        BigDecimal netAmount = booking.getNetAmount() != null ? booking.getNetAmount() : BigDecimal.ZERO;
        BigDecimal stillDue = cancelled ? BigDecimal.ZERO : netAmount.subtract(netPaid).max(BigDecimal.ZERO);

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setSpacingAfter(16);

        if (settledTotal.signum() > 0) {
            addFactRow(table, "Paid", bdt(settledTotal));
        }
        if (refundedTotal.signum() > 0) {
            addFactRow(table, "Refunded", "-" + bdt(refundedTotal));
        }
        addFactRow(table, stillDue.signum() > 0 ? "Still due" : cancelled ? "Net charged" : "Settled",
                bdt(stillDue.signum() > 0 ? stillDue : netPaid));

        document.add(table);
    }

    private void addQrCode(Document document, BookingResponse booking)
            throws WriterException, IOException, DocumentException {
        String link = frontendUrl + "/player/bookings/" + booking.getId();

        QRCodeWriter writer = new QRCodeWriter();
        BitMatrix matrix = writer.encode(link, BarcodeFormat.QR_CODE, 220, 220);
        BufferedImage qrImage = MatrixToImageWriter.toBufferedImage(matrix);
        ByteArrayOutputStream qrBytes = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(qrImage, "png", qrBytes);

        Image image = Image.getInstance(qrBytes.toByteArray());
        image.setAlignment(Element.ALIGN_CENTER);
        image.scaleToFit(120, 120);

        Paragraph caption = new Paragraph("Scan to open this booking",
                FontFactory.getFont(FontFactory.HELVETICA, 9, MUTED_GRAY));
        caption.setAlignment(Element.ALIGN_CENTER);
        caption.setSpacingBefore(8);

        document.add(image);
        document.add(caption);
    }

    private void addFooter(Document document) throws DocumentException {
        Paragraph footer = new Paragraph(
                "Generated " + OffsetDateTime.now().format(TIMESTAMP_FORMAT),
                FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8, MUTED_GRAY));
        footer.setAlignment(Element.ALIGN_CENTER);
        footer.setSpacingBefore(18);
        document.add(footer);
    }

    private void addSectionTitle(Document document, String title) throws DocumentException {
        Paragraph heading = new Paragraph(title, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12));
        heading.setSpacingBefore(6);
        heading.setSpacingAfter(6);
        document.add(heading);
    }

    private void addFactRow(PdfPTable table, String label, String value) {
        Font labelFont = FontFactory.getFont(FontFactory.HELVETICA, 9, MUTED_GRAY);
        Font valueFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);

        PdfPCell labelCell = new PdfPCell(new Paragraph(label, labelFont));
        labelCell.setBorder(com.lowagie.text.Rectangle.BOTTOM);
        labelCell.setBorderColor(new Color(228, 234, 230));
        labelCell.setPadding(5);
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Paragraph(value, valueFont));
        valueCell.setBorder(com.lowagie.text.Rectangle.BOTTOM);
        valueCell.setBorderColor(new Color(228, 234, 230));
        valueCell.setPadding(5);
        valueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(valueCell);
    }

    private void addBodyCell(PdfPTable table, String text, Font font) {
        PdfPCell cell = new PdfPCell(new Paragraph(text, font));
        cell.setPadding(5);
        table.addCell(cell);
    }

    private String safe(Object value) {
        return value == null ? "—" : String.valueOf(value);
    }

    private String joinNonBlank(String delimiter, String... parts) {
        String joined = Arrays.stream(parts)
                .filter(p -> p != null && !p.isBlank())
                .reduce((a, b) -> a + delimiter + b)
                .orElse("");
        return joined.isBlank() ? "—" : joined;
    }

    private String formatDate(java.time.LocalDate date) {
        if (date == null) {
            return "—";
        }
        return date.format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy", Locale.ENGLISH));
    }

    private String formatTimeRange(java.time.LocalTime start, java.time.LocalTime end) {
        if (start == null) {
            return "—";
        }
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);
        String from = start.format(fmt);
        if (end == null) {
            return from;
        }
        return from + " – " + end.format(fmt);
    }

    /**
     * BDT currency, rounded like the frontend's `bdt()` helper — but prefixed
     * "BDT" rather than "৳". PDF's built-in fonts (Helvetica/WinAnsiEncoding)
     * have no glyph for the Bengali Taka sign; without bundling and embedding
     * a Unicode font just for one character, it renders as a missing-glyph
     * box instead of the currency symbol the frontend shows.
     */
    private String bdt(BigDecimal amount) {
        if (amount == null) {
            return "BDT 0";
        }
        BigDecimal rounded = amount.setScale(0, RoundingMode.HALF_UP);
        return "BDT " + String.format(Locale.US, "%,d", rounded.longValue());
    }
}
