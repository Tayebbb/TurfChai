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
import com.lowagie.text.Phrase;
import com.lowagie.text.Rectangle;
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
 *
 * <p>
 * The layout is a fixed, single-page "ticket stub" design — a colored header
 * band, a stat-chip row, a two-column body (price + transactions on the
 * left, a summary/QR stub on the right), and a footer. Every section has a
 * hard-capped height (the transaction list truncates past a handful of
 * rows) so the page count can never exceed one regardless of how much
 * payment history a booking accumulates — there is no dynamic
 * font-shrinking or overflow logic to keep correct.
 */
@Service
public class BookingPdfService {

    /** Past this many rows, the transaction list truncates with a "+N more" note. */
    private static final int MAX_TRANSACTION_ROWS = 5;

    // ---- Palette: mirrors the frontend's design tokens (tokens.css light theme) ----
    private static final Color BRAND = new Color(14, 122, 74);
    private static final Color BRAND_DARK = new Color(9, 84, 52);
    private static final Color INK = new Color(18, 32, 25);
    private static final Color MUTED = new Color(89, 108, 98);
    private static final Color FAINT = new Color(150, 165, 157);
    private static final Color SURFACE = new Color(240, 244, 242);
    private static final Color SURFACE_SOFT = new Color(247, 249, 248);
    private static final Color BORDER = new Color(228, 234, 230);
    private static final Color WHITE = Color.WHITE;

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
            // Tight, even margins — the header band and footer rule read as
            // page-edge-to-edge, which is what makes a receipt feel designed
            // rather than a generic document with default whitespace.
            Document document = new Document(PageSize.A4, 0, 0, 0, 28);
            PdfWriter.getInstance(document, out);
            document.open();

            addHeaderBand(document, booking);

            // Everything below the band sits inside the page's side margins;
            // the band itself is full-bleed, so content resumes at x=40.
            Paragraph spacer = new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 4));
            spacer.setSpacingAfter(0);

            addBodyWrapper(document, booking, payments);
            addFooter(document);

            document.close();
            return out.toByteArray();
        } catch (DocumentException | IOException | WriterException e) {
            throw new IllegalStateException("Could not generate booking PDF", e);
        }
    }

    // ---------------------------------------------------------------------
    // Header band
    // ---------------------------------------------------------------------

    private void addHeaderBand(Document document, BookingResponse booking) throws DocumentException {
        PdfPTable band = new PdfPTable(2);
        band.setWidthPercentage(100);
        band.setWidths(new float[] { 3f, 2f });

        Paragraph brand = new Paragraph();
        brand.add(new Chunk("TurfChai", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, WHITE)));
        brand.add(new Chunk("  Booking receipt", FontFactory.getFont(FontFactory.HELVETICA, 11,
                new Color(220, 236, 227))));
        brand.setSpacingBefore(2);

        Paragraph code = new Paragraph(safe(booking.getBookingCode()),
                FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(220, 236, 227)));
        code.setSpacingBefore(4);

        PdfPCell left = new PdfPCell();
        left.setBorder(Rectangle.NO_BORDER);
        left.setBackgroundColor(BRAND);
        left.setPadding(0);
        left.setPaddingLeft(40);
        left.setPaddingTop(26);
        left.setPaddingBottom(26);
        left.addElement(brand);
        left.addElement(code);
        left.setVerticalAlignment(Element.ALIGN_MIDDLE);
        band.addCell(left);

        PdfPCell right = new PdfPCell(new Phrase(statusPill(booking.getStatus())));
        right.setBorder(Rectangle.NO_BORDER);
        right.setBackgroundColor(BRAND);
        right.setPaddingRight(40);
        right.setHorizontalAlignment(Element.ALIGN_RIGHT);
        right.setVerticalAlignment(Element.ALIGN_MIDDLE);
        band.addCell(right);

        document.add(band);
    }

    private Phrase statusPill(String status) {
        String label = safe(status);
        Font font = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, WHITE);
        return new Phrase("● " + label, font);
    }

    // ---------------------------------------------------------------------
    // Body: stat chips + two-column (price/transactions | summary/QR)
    // ---------------------------------------------------------------------

    private void addBodyWrapper(Document document, BookingResponse booking, List<PaymentResponse> payments)
            throws DocumentException, WriterException, IOException {
        // A single outer table with generous side padding stands in for page
        // margins, so it lines up under the full-bleed header band above.
        PdfPTable outer = new PdfPTable(1);
        outer.setWidthPercentage(100);
        PdfPCell wrap = new PdfPCell();
        wrap.setBorder(Rectangle.NO_BORDER);
        wrap.setPaddingLeft(40);
        wrap.setPaddingRight(40);
        wrap.setPaddingTop(20);

        addVenueHeading(wrap, booking);
        wrap.addElement(statChips(booking));
        wrap.addElement(spacer(14));
        wrap.addElement(twoColumnBody(booking, payments));

        outer.addCell(wrap);
        document.add(outer);
    }

    /**
     * Adds the venue name + area/address line directly to the cell as two
     * sibling paragraphs — not one nested inside the other. A Paragraph
     * added as an element *of* another Paragraph loses its own
     * spacingBefore/After (only honoured when a paragraph is added directly
     * to a cell/document), which is what made the venue name and the
     * address line beneath it render with almost no gap.
     */
    private void addVenueHeading(PdfPCell wrap, BookingResponse booking) {
        Paragraph heading = new Paragraph(safe(booking.getVenueName()),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 17, INK));
        heading.setSpacingAfter(4);
        wrap.addElement(heading);

        String sub = joinNonBlank(" · ", booking.getVenueArea(), booking.getVenueAddress());
        Paragraph subLine = new Paragraph(sub, FontFactory.getFont(FontFactory.HELVETICA, 10, MUTED));
        subLine.setSpacingAfter(16);
        wrap.addElement(subLine);
    }

    /** Four compact info chips — Date / Play time / Pitch / Arrive by. */
    private PdfPTable statChips(BookingResponse booking) {
        String[] labels = { "DATE", "PLAY TIME", "PITCH", "ARRIVE BY" };
        String[] values = {
                formatDate(booking.getBookingDate()),
                formatTimeRange(booking.getStartTime(), booking.getEndTime()),
                safe(booking.getPitchName()),
                "10 min early",
        };

        PdfPTable chips = new PdfPTable(4);
        chips.setWidthPercentage(100);
        chips.setSpacingAfter(6);
        for (int i = 0; i < labels.length; i++) {
            PdfPCell cell = new PdfPCell();
            cell.setBackgroundColor(SURFACE_SOFT);
            cell.setBorder(Rectangle.NO_BORDER);
            cell.setPadding(10);
            cell.setPaddingBottom(9);
            if (i > 0) {
                cell.setPaddingLeft(12);
            }

            Paragraph label = new Paragraph(labels[i], FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, FAINT));
            label.setSpacingAfter(3);
            Paragraph value = new Paragraph(values[i], FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10.5f, INK));

            cell.addElement(label);
            cell.addElement(value);
            chips.addCell(cell);
        }
        return chips;
    }

    private PdfPTable twoColumnBody(BookingResponse booking, List<PaymentResponse> payments)
            throws WriterException, IOException {
        PdfPTable columns = new PdfPTable(2);
        columns.setWidthPercentage(100);
        columns.setWidths(new float[] { 3f, 2f });

        PdfPCell leftCell = new PdfPCell();
        leftCell.setBorder(Rectangle.NO_BORDER);
        leftCell.setPaddingRight(16);
        leftCell.addElement(priceBreakdownCard(booking));
        leftCell.addElement(spacer(10));
        leftCell.addElement(transactionsCard(payments));
        columns.addCell(leftCell);

        PdfPCell rightCell = new PdfPCell();
        rightCell.setBorder(Rectangle.NO_BORDER);
        rightCell.addElement(summaryAndQrCard(booking, payments));
        columns.addCell(rightCell);

        return columns;
    }

    // ---------------------------------------------------------------------
    // Cards
    // ---------------------------------------------------------------------

    private PdfPTable priceBreakdownCard(BookingResponse booking) {
        PdfPTable card = cardShell("Price breakdown");

        addFactRow(card, "Slot price", bdt(booking.getAmount()), false);
        if (booking.getDiscountAmount() != null && booking.getDiscountAmount().signum() > 0) {
            String promoLabel = booking.getPromoCode() != null && !booking.getPromoCode().isBlank()
                    ? "Discount · " + booking.getPromoCode()
                    : "Discount";
            addFactRow(card, promoLabel, "−" + bdt(booking.getDiscountAmount()), false);
        }
        addFactRow(card, "Net amount", bdt(booking.getNetAmount()), true);

        return card;
    }

    private PdfPTable transactionsCard(List<PaymentResponse> payments) {
        PdfPTable card = cardShell("Transactions");

        List<PaymentResponse> safePayments = payments == null ? List.of() : payments;
        if (safePayments.isEmpty()) {
            PdfPCell empty = new PdfPCell(new Paragraph("No payments recorded yet.",
                    FontFactory.getFont(FontFactory.HELVETICA, 9, MUTED)));
            empty.setBorder(Rectangle.NO_BORDER);
            empty.setPadding(4);
            card.addCell(empty);
            return card;
        }

        // Hard cap: guarantees the page can never overflow no matter how many
        // payment/refund rows a booking has accumulated.
        List<PaymentResponse> shown = safePayments.size() > MAX_TRANSACTION_ROWS
                ? safePayments.subList(0, MAX_TRANSACTION_ROWS)
                : safePayments;

        for (PaymentResponse payment : shown) {
            addTransactionRow(card, payment);
        }
        if (safePayments.size() > shown.size()) {
            PdfPCell more = new PdfPCell(new Paragraph(
                    "+" + (safePayments.size() - shown.size()) + " more — see the full history in the app",
                    FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8, FAINT)));
            more.setBorder(Rectangle.NO_BORDER);
            more.setPaddingTop(6);
            card.addCell(more);
        }

        return card;
    }

    private void addTransactionRow(PdfPTable card, PaymentResponse payment) {
        boolean fromWallet = Boolean.TRUE.equals(payment.getFromWallet());
        boolean isRefund = payment.getType() != null && payment.getType().name().equals("REFUND");
        String detail = fromWallet
                ? (isRefund ? "Refund to wallet" : "Wallet credit")
                : (isRefund ? "Refund" : "Booking payment");
        String method = fromWallet ? "Wallet" : String.valueOf(payment.getMethod());
        String when = payment.getPaidAt() != null ? payment.getPaidAt().toLocalDate().toString()
                : payment.getCreatedAt() != null ? payment.getCreatedAt().toLocalDate().toString() : "—";
        boolean success = payment.getStatus() != null && payment.getStatus().name().equals("SUCCESS");

        PdfPTable row = new PdfPTable(2);
        row.setWidthPercentage(100);
        row.setWidths(new float[] { 3f, 2f });

        // Two deliberate lines rather than one long line left to wrap on its
        // own — at this column width a single wrapped line breaks mid-date
        // unpredictably ("2026-\n08-17"); a fixed detail/meta split never
        // does. Two separate Paragraphs (not one Paragraph + Chunk.NEWLINE):
        // a shared Paragraph's leading is computed once, from whichever font
        // it saw first, so mixing the bold 9.5pt detail line with the
        // smaller 7.5pt meta line left almost no visible gap between them —
        // explicit spacingBefore on the second paragraph is what actually
        // controls the gap.
        Paragraph detailLine = new Paragraph(detail, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, INK));
        Paragraph metaLine = new Paragraph(method + " · " + when, FontFactory.getFont(FontFactory.HELVETICA, 7.5f, MUTED));
        metaLine.setSpacingBefore(3f);

        PdfPCell leftCell = new PdfPCell();
        leftCell.setBorder(Rectangle.BOTTOM);
        leftCell.setBorderColor(BORDER);
        leftCell.setPadding(6);
        leftCell.setPaddingBottom(7);
        leftCell.addElement(detailLine);
        leftCell.addElement(metaLine);
        row.addCell(leftCell);

        Paragraph amount = new Paragraph((isRefund ? "−" : "") + bdt(payment.getAmount()),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, success ? INK : FAINT));
        PdfPCell rightCell = new PdfPCell(amount);
        rightCell.setBorder(Rectangle.BOTTOM);
        rightCell.setBorderColor(BORDER);
        rightCell.setPadding(6);
        rightCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        rightCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
        row.addCell(rightCell);

        PdfPCell wrapCell = new PdfPCell(row);
        wrapCell.setBorder(Rectangle.NO_BORDER);
        wrapCell.setPadding(0);
        card.addCell(wrapCell);
    }

    private PdfPTable summaryAndQrCard(BookingResponse booking, List<PaymentResponse> payments)
            throws WriterException, IOException {
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
        String dueLabel = stillDue.signum() > 0 ? "Still due" : cancelled ? "Net charged" : "Settled";
        BigDecimal dueValue = stillDue.signum() > 0 ? stillDue : netPaid;

        // A single soft "stub" card housing both the running total and the QR,
        // set off from the two-column price/transactions area on the left —
        // the boarding-pass-style panel a player would actually keep.
        PdfPTable stub = new PdfPTable(1);
        stub.setWidthPercentage(100);
        PdfPCell shell = new PdfPCell();
        shell.setBackgroundColor(SURFACE);
        shell.setBorder(Rectangle.NO_BORDER);
        shell.setPadding(16);

        Paragraph dueLine = new Paragraph(dueLabel.toUpperCase(Locale.ENGLISH),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 7.5f, MUTED));
        dueLine.setSpacingAfter(2);
        Paragraph dueAmount = new Paragraph(bdt(dueValue),
                FontFactory.getFont(FontFactory.HELVETICA_BOLD, 19, stillDue.signum() > 0 ? BRAND_DARK : INK));
        dueAmount.setSpacingAfter(12);
        shell.addElement(dueLine);
        shell.addElement(dueAmount);

        if (settledTotal.signum() > 0) {
            addStubLine(shell, "Paid", bdt(settledTotal));
        }
        if (refundedTotal.signum() > 0) {
            addStubLine(shell, "Refunded", "−" + bdt(refundedTotal));
        }

        shell.addElement(spacer(10));
        shell.addElement(divider());
        shell.addElement(spacer(10));

        Image qr = buildQrImage(booking);
        qr.setAlignment(Element.ALIGN_CENTER);
        shell.addElement(qr);

        Paragraph caption = new Paragraph("Scan to open this booking",
                FontFactory.getFont(FontFactory.HELVETICA, 8, MUTED));
        caption.setAlignment(Element.ALIGN_CENTER);
        caption.setSpacingBefore(6);
        shell.addElement(caption);

        stub.addCell(shell);
        return stub;
    }

    private void addStubLine(PdfPCell shell, String label, String value) {
        Paragraph line = new Paragraph();
        line.add(new Chunk(label, FontFactory.getFont(FontFactory.HELVETICA, 9, MUTED)));
        // Right-align the value with tab-like spacing; a nested table would be
        // more precise but this stub is a narrow single column, so a simple
        // two-line pairing reads cleanly without the extra table nesting.
        Paragraph valueLine = new Paragraph(value, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, INK));
        valueLine.setSpacingAfter(4);
        shell.addElement(line);
        shell.addElement(valueLine);
    }

    // ---------------------------------------------------------------------
    // Shared building blocks
    // ---------------------------------------------------------------------

    /** A titled card shell — light border, generous internal padding, no fill. */
    private PdfPTable cardShell(String title) {
        PdfPTable card = new PdfPTable(1);
        card.setWidthPercentage(100);
        card.setSpacingAfter(0);

        Paragraph heading = new Paragraph(title, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11, INK));
        heading.setSpacingAfter(8);
        PdfPCell headCell = new PdfPCell(heading);
        headCell.setBorder(Rectangle.NO_BORDER);
        headCell.setPadding(0);
        headCell.setPaddingBottom(2);
        card.addCell(headCell);

        return card;
    }

    private void addFactRow(PdfPTable card, String label, String value, boolean emphasize) {
        PdfPTable row = new PdfPTable(2);
        row.setWidthPercentage(100);

        Font labelFont = FontFactory.getFont(FontFactory.HELVETICA, emphasize ? 10 : 9.5f, emphasize ? INK : MUTED);
        Font valueFont = FontFactory.getFont(emphasize ? FontFactory.HELVETICA_BOLD : FontFactory.HELVETICA_BOLD,
                emphasize ? 11 : 9.5f, INK);

        PdfPCell labelCell = new PdfPCell(new Paragraph(label, labelFont));
        labelCell.setBorder(emphasize ? Rectangle.TOP : Rectangle.NO_BORDER);
        labelCell.setBorderColor(BORDER);
        labelCell.setPaddingTop(emphasize ? 8 : 4);
        labelCell.setPaddingBottom(4);
        row.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Paragraph(value, valueFont));
        valueCell.setBorder(emphasize ? Rectangle.TOP : Rectangle.NO_BORDER);
        valueCell.setBorderColor(BORDER);
        valueCell.setPaddingTop(emphasize ? 8 : 4);
        valueCell.setPaddingBottom(4);
        valueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        row.addCell(valueCell);

        PdfPCell wrapCell = new PdfPCell(row);
        wrapCell.setBorder(Rectangle.NO_BORDER);
        wrapCell.setPadding(0);
        card.addCell(wrapCell);
    }

    private Paragraph divider() {
        Paragraph rule = new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, 2));
        rule.setSpacingAfter(0);
        return rule;
    }

    private Paragraph spacer(float height) {
        Paragraph p = new Paragraph(" ", FontFactory.getFont(FontFactory.HELVETICA, height * 0.7f));
        p.setLeading(height);
        return p;
    }

    private void addFooter(Document document) throws DocumentException {
        PdfPTable footer = new PdfPTable(1);
        footer.setWidthPercentage(100);
        footer.setSpacingBefore(6);

        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.TOP);
        cell.setBorderColor(BORDER);
        cell.setPaddingTop(8);
        cell.setPaddingLeft(40);
        cell.setPaddingRight(40);

        Paragraph line = new Paragraph(
                "Generated " + OffsetDateTime.now().format(TIMESTAMP_FORMAT)
                        + "  ·  TurfChai — book turfs, courts and pitches",
                FontFactory.getFont(FontFactory.HELVETICA, 7.5f, FAINT));
        line.setAlignment(Element.ALIGN_CENTER);
        cell.addElement(line);

        footer.addCell(cell);
        document.add(footer);
    }

    private Image buildQrImage(BookingResponse booking) throws WriterException, IOException {
        String link = frontendUrl + "/player/bookings/" + booking.getId();

        QRCodeWriter writer = new QRCodeWriter();
        BitMatrix matrix = writer.encode(link, BarcodeFormat.QR_CODE, 200, 200);
        BufferedImage qrImage = MatrixToImageWriter.toBufferedImage(matrix);
        ByteArrayOutputStream qrBytes = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(qrImage, "png", qrBytes);

        Image image = Image.getInstance(qrBytes.toByteArray());
        image.scaleToFit(96, 96);
        return image;
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
