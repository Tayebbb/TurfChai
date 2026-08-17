import { useState } from "react";
import { useParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { downloadBookingPdf, getBooking } from "@/api/bookings";
import { getPaymentsForBooking, getRefundPreview } from "@/api/payments";
import { getUser } from "@/api/client";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { canCall, canGetDirections, callNumber, openDirections } from "@/utils/deviceActions";
import { toUserMessage } from "@/utils/errorMessage";
import { paths } from "@/routes/paths";
import "./BookingDetailPage.css";

const STATUS_BADGE = {
  CONFIRMED: { label: "Confirmed", className: "badge green" },
  PENDING: { label: "Pending", className: "badge amber" },
  CANCELLED: { label: "Cancelled", className: "badge" },
};

const PAYMENT_TYPE_LABEL = {
  BOOKING: "Booking payment",
  REFUND: "Refund",
};

const bdt = (value) =>
  value == null ? "—" : `৳${Math.round(Number(value)).toLocaleString("en-IN")}`;

function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const { showToast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data: booking, loading, error } = useApi(
    () => getBooking(bookingId),
    [bookingId],
  );

  const handleDownloadPdf = async () => {
    if (!booking) return;
    setDownloadingPdf(true);
    try {
      await downloadBookingPdf(booking);
    } catch (downloadError) {
      showToast(toUserMessage(downloadError, "Could not download the PDF. Please try again."));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const paymentsApi = useApi(
    () => (bookingId ? getPaymentsForBooking(bookingId) : Promise.resolve([])),
    [bookingId],
  );
  const payments = paymentsApi.data ?? [];

  const venueForActions = {
    name: booking?.venueName,
    address: booking?.venueAddress,
    area: booking?.venueArea,
    lat: booking?.venueLat,
    lng: booking?.venueLng,
  };

  const refundPreviewApi = useApi(
    () => (bookingId && booking?.status === "CONFIRMED" ? getRefundPreview(bookingId) : Promise.resolve(null)),
    [bookingId, booking?.status],
  );

  const currentUser = getUser();
  const isOwner =
    booking &&
    currentUser &&
    Number(booking.userId) === Number(currentUser.id);

  const badge = STATUS_BADGE[booking?.status] ?? STATUS_BADGE.CONFIRMED;

  if (loading) {
    return (
      <>
        <PageTitle title="Booking" />
        <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
          <p className="subtle" role="status">
            Loading booking…
          </p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="Booking" />
        <main className="wrap" id="main" style={{ paddingTop: 20, maxWidth: 1000 }}>
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>Could not load this booking</h1>
            <p className="subtle">{error.message}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <Button variant="secondary" to={paths.player.bookings}>
                My bookings
              </Button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const code = booking?.bookingCode || "—";
  const createdAt = booking?.createdAt ? new Date(booking.createdAt).toLocaleString() : "";
  const playTime =
    booking?.startTime && booking?.endTime
      ? `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
      : "—";

  const facts = [
    { id: "venue", label: "VENUE", value: booking?.venueName || "—" },
    { id: "pitch", label: "PITCH", value: booking?.pitchName || "—" },
    { id: "date", label: "DATE", value: formatDate(booking?.bookingDate) || "—" },
    { id: "play", label: "PLAY TIME", value: playTime, num: true },
    { id: "handover", label: "ARRIVE BY", value: "10 min early" },
  ];

  // Chronological, oldest first: booking created -> each payment/refund in order.
  const timeline = [
    { id: "created", title: "Booking created", when: formatDateTime(booking?.createdAt) },
    ...payments
        .slice()
        .reverse()
        .map((p) => ({
          id: `payment-${p.id}`,
          title:
            p.type === "REFUND"
              ? p.fromWallet
                ? `${bdt(p.amount)} returned to your wallet`
                : `Refund of ${bdt(p.amount)} recorded`
              : p.fromWallet
                ? `Wallet credit applied — ${bdt(p.amount)}`
                : p.status === "SUCCESS"
                  ? `${p.method} payment received — ${bdt(p.amount)}`
                  : `${p.method} payment declined — ${bdt(p.amount)}`,
          when: `${formatDateTime(p.paidAt || p.createdAt)}${p.txnReference ? ` · ${p.txnReference}` : ""}`,
          state: p.status === "FAILED" ? "pending" : undefined,
        })),
  ];

  // A split payment writes one row per tender, so the total has to be a sum.
  // Reading a single row reported only the first leg as the amount paid.
  const settledTotal = payments
    .filter((p) => p.type === "BOOKING" && p.status !== "FAILED")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const refundPayment = payments.find((p) => p.type === "REFUND");
  const refundedTotal = payments
    .filter((p) => p.type === "REFUND" && p.status !== "FAILED")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  // What the player still owes, rather than what has already been collected.
  // The summary used to label the settled figure "Total due", so an unpaid
  // booking claimed a balance of zero and a paid one claimed the full price.
  const netPaid = settledTotal - refundedTotal;
  const isCancelled = booking?.status === "CANCELLED";
  const stillDue = isCancelled
    ? 0
    : Math.max(0, Number(booking?.netAmount ?? 0) - netPaid);

  return (
    <>
      <PageTitle title={`Booking ${code}`} />
      <main
        className="wrap"
        id="main"
        style={{ paddingTop: 20, maxWidth: 1000 }}
      >
        <Breadcrumbs
          items={[
            { label: "My bookings", to: paths.player.bookings },
            { label: code },
          ]}
        />

        <div
          className="between"
          style={{ flexWrap: "wrap", gap: 10, marginBottom: 16 }}
        >
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 2 }}>Booking {code}</h1>
            <span className="subtle">
              {[booking?.venueName, booking?.venueArea].filter(Boolean).join(" · ")}
              {createdAt ? `${booking?.venueName ? " · " : ""}Booked ${createdAt}` : ""}
            </span>
          </div>
          <div className="row-wrap">
            <span className={badge.className}>{badge.label}</span>
          </div>
        </div>

        <div className="bd-grid">
          <div className="stack">
            {/* Single source of truth */}
            <section className="card">
              <h3>Match details</h3>
              <div className="grid3" style={{ marginTop: 8, gap: 10 }}>
                {facts.map((fact) => (
                  <div className="panel" key={fact.id}>
                    <span className="tiny subtle">{fact.label}</span>
                    <br />
                    <b className={fact.num ? "num" : undefined}>{fact.value}</b>
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <Button size="sm" variant="primary" to={paths.player.matchdayFor(booking?.id)}>
                  Open match-day ticket
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canGetDirections(venueForActions)}
                  onClick={() => openDirections(venueForActions)}
                >
                  Directions
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canCall(booking?.venueContactPhone)}
                  title={canCall(booking?.venueContactPhone) ? undefined : 'This venue has not published a phone number'}
                  onClick={() => callNumber(booking?.venueContactPhone)}
                >
                  Contact venue
                </Button>
              </div>
            </section>

            {/* Timeline */}
            <section className="card">
              <h3>Timeline</h3>
              <ul className="tline" style={{ marginTop: 10 }}>
                {timeline.map((entry) => (
                  <li className={entry.state} key={entry.id}>
                    <b className="small">{entry.title}</b>
                    <div className="when">{entry.when}</div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Transactions */}
            <section className="card">
              <h3>Transactions</h3>
              {payments.length === 0 ? (
                <p className="subtle small" style={{ marginTop: 8 }}>
                  {paymentsApi.loading ? "Loading…" : "No payments recorded yet."}
                </p>
              ) : (
                <div
                  className="table-wrap"
                  style={{ marginTop: 8, border: "none" }}
                >
                  <table className="table" style={{ minWidth: 480 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Detail</th>
                        <th>Method</th>
                        <th className="num">Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((row) => (
                        <tr key={row.id}>
                          <td>{formatDate((row.paidAt || row.createdAt || "").slice(0, 10))}</td>
                          <td>
                            {row.fromWallet
                              ? row.type === "REFUND"
                                ? "Refund to wallet"
                                : "Wallet credit"
                              : (PAYMENT_TYPE_LABEL[row.type] ?? row.type)}
                          </td>
                          <td>{row.fromWallet ? "Wallet" : row.method}</td>
                          <td className="num">{bdt(row.amount)}</td>
                          <td>
                            <span className={row.status === "SUCCESS" ? "badge green" : "badge"}>
                              {row.status === "SUCCESS"
                                ? (row.type === "REFUND" ? "Refunded" : "Recorded")
                                : row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="stack">
            <div className="pdf-cta">
              <span className="pdf-cta-icon" aria-hidden="true">
                📄
              </span>
              <span className="pdf-cta-text">
                <b>Get your receipt</b>
                <span>A full PDF copy of this booking, with a scannable ticket QR.</span>
              </span>
              <Button
                className={`pdf-cta-btn btn-shine${downloadingPdf ? " is-busy" : ""}`}
                variant="primary"
                disabled={!booking}
                loading={downloadingPdf}
                onClick={handleDownloadPdf}
              >
                Download PDF
              </Button>
            </div>
            <div className="glass glass-card">
              <h4>Payment summary</h4>
              <div className="pricerow">
                <span>Slot</span>
                <span className="num">{bdt(booking?.netAmount)}</span>
              </div>
              {settledTotal > 0 ? (
                <div className="pricerow">
                  <span>Paid</span>
                  <span className="num">{bdt(settledTotal)}</span>
                </div>
              ) : null}
              {refundPayment ? (
                <div className="pricerow">
                  <span className="neg">Refunded</span>
                  <span className="num neg">−{bdt(refundedTotal)}</span>
                </div>
              ) : null}
              <div className="pricerow total">
                <span>{stillDue > 0 ? "Still due" : isCancelled ? "Net charged" : "Settled"}</span>
                <span className="num">{bdt(stillDue > 0 ? stillDue : netPaid)}</span>
              </div>
              <p className="tiny subtle" style={{ margin: '8px 0 0' }}>
                {stillDue > 0
                  ? `${bdt(stillDue)} is payable to the venue on match day.`
                  : isCancelled
                    ? 'This booking is cancelled — nothing further is owed.'
                    : 'Nothing left to pay for this booking.'}
              </p>
            </div>
            <div className="card">
              <h4>Cancellation policy</h4>
              <p className="small muted" style={{ margin: "4px 0 10px" }}>
                {booking?.status !== "CONFIRMED"
                  ? "This booking can no longer be cancelled."
                  : refundPreviewApi.data
                    ? `Cancelling now refunds ${refundPreviewApi.data.refundPercent}% (${bdt(refundPreviewApi.data.refundAmount)}), per this venue's policy.`
                    : "Loading refund policy…"}
              </p>
              <div className="stack-sm">
                {isOwner && booking?.status === "CONFIRMED" ? (
                  <Button
                    size="sm"
                    variant="ghostDanger"
                    block
                    to={paths.player.cancelFor(bookingId)}
                  >
                    Cancel booking
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    block
                    disabled
                    title="Posting a replacement search isn't available yet — cancel the booking if you can't make it."
                  >
                    Find replacement player
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
