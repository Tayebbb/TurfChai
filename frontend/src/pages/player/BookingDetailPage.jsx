import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Field, Input } from "@/components/forms/Field";
import { Overlay } from "@/components/modals/Overlay";
import { QrCode } from "@/components/common/QrCode";
import { downloadBookingPdf, getBooking } from "@/api/bookings";
import { getPaymentsForBooking, getRefundPreview } from "@/api/payments";
import { getOpenGame } from "@/api/openGames";
import { enableBookingSplit, getBookingSplitStatus } from "@/api/splitPayment";
import { CreateGameDrawer } from "@/solo/CreateGameDrawer";
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
  SPLIT_SHARE: "Split share",
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
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Split and open game states — seeded from the ?action= URL param on mount
  const [splitModalOpen, setSplitModalOpen] = useState(
    searchParams.get("action") === "split",
  );
  const [splitPlayerCount, setSplitPlayerCount] = useState("5");
  const [enablingSplit, setEnablingSplit] = useState(false);
  const [activeQrMember, setActiveQrMember] = useState(null);
  const [openGameDrawerOpen, setOpenGameDrawerOpen] = useState(
    searchParams.get("action") === "open-game",
  );

  const { data: booking, loading, error, reload: reloadBooking } = useApi(
    () => getBooking(bookingId),
    [bookingId],
  );

  const currentUser = getUser();
  const isOwner =
    booking &&
    currentUser &&
    Number(booking.userId) === Number(currentUser.id);

  // Split status
  const splitApi = useApi(
    () => (bookingId && isOwner ? getBookingSplitStatus(bookingId) : Promise.resolve(null)),
    [bookingId, isOwner, booking?.splitEnabled],
  );
  const splitData = splitApi.data;

  // Linked open game status if posted
  const openGameId = booking?.openGameId || splitData?.openGameId;
  const openGameApi = useApi(
    () => (openGameId ? getOpenGame(openGameId) : Promise.resolve(null)),
    [openGameId],
  );
  const openGameData = openGameApi.data;

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

  const handleEnableSplit = async (e) => {
    e?.preventDefault?.();
    const count = Number(splitPlayerCount);
    if (!count || count < 2 || count > 50) {
      showToast("Player count must be between 2 and 50");
      return;
    }
    setEnablingSplit(true);
    try {
      await enableBookingSplit(bookingId, { playerCount: count });
      showToast("Price split enabled! Share links are ready 🚀");
      setSplitModalOpen(false);
      splitApi.reload();
      reloadBooking();
    } catch (err) {
      showToast(toUserMessage(err, "Could not enable split."));
    } finally {
      setEnablingSplit(false);
    }
  };

  const getShareUrl = (token) => {
    if (!token) return "";
    return `${window.location.origin}${paths.player.payShareFor(token)}`;
  };

  const handleCopyShareLink = async (token) => {
    const url = getShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied to clipboard 📋");
    } catch {
      showToast("Could not copy link");
    }
  };

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

  const settledTotal = payments
    .filter((p) => (p.type === "BOOKING" || p.type === "SPLIT_SHARE") && p.status !== "FAILED")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const refundPayment = payments.find((p) => p.type === "REFUND");
  const refundedTotal = payments
    .filter((p) => p.type === "REFUND" && p.status !== "FAILED")
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  const netPaid = settledTotal - refundedTotal;
  const isCancelled = booking?.status === "CANCELLED";
  const stillDue = isCancelled
    ? 0
    : Math.max(0, Number(booking?.netAmount ?? 0) - netPaid);

  const isSplitActive = splitData?.splitEnabled && Array.isArray(splitData?.members) && splitData.members.length > 0;
  const paidMembersCount = splitData?.paidCount ?? 0;
  const totalMembersCount = splitData?.totalPlayers ?? 0;
  const splitPercent = totalMembersCount > 0 ? Math.round((paidMembersCount / totalMembersCount) * 100) : 0;

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
            {/* Match details */}
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
            {/* Squad & Sharing Card */}
            {isOwner && booking?.status === "CONFIRMED" ? (
              <div className="squad-card">
                <div className="between" style={{ marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}>⚽ Squad &amp; Sharing</h4>
                  {isSplitActive ? (
                    <span className="badge green nodot">{paidMembersCount}/{totalMembersCount} Paid</span>
                  ) : null}
                </div>

                {isSplitActive ? (
                  <div>
                    <p className="small subtle" style={{ margin: "0 0 6px" }}>
                      Split equally ({bdt(splitData.shareAmount)} / person). Share the link or QR with friends to collect their share.
                    </p>

                    <div className="squad-progress-bar-bg">
                      <div className="squad-progress-bar-fill" style={{ width: `${splitPercent}%` }} />
                    </div>

                    <div style={{ maxHeight: 220, overflowY: "auto", margin: "10px 0" }}>
                      {splitData.members.map((m, idx) => {
                        const isPaid = m.paymentStatus === "PAID";
                        const shareUrl = getShareUrl(m.shareToken);
                        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `Hey! Pay your share (${bdt(m.shareAmount)}) for our turf match at ${booking?.venueName}:\n${shareUrl}`
                        )}`;

                        return (
                          <div key={m.id} className="split-member-item">
                            <div className="split-member-left">
                              <span style={{ fontSize: 15 }}>{m.isCaptain ? "👑" : "👤"}</span>
                              <div>
                                <b style={{ display: "block", fontSize: 13 }}>
                                  {m.isCaptain ? "You (Host)" : m.userName || `Player ${idx + 1}`}
                                </b>
                                <span className="tiny subtle">{bdt(m.shareAmount)}</span>
                              </div>
                            </div>

                            <div className="split-member-actions">
                              {isPaid ? (
                                <span className="badge green nodot">Paid ✓</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="share-mini-btn"
                                    title="Show QR Code"
                                    onClick={() => setActiveQrMember(m)}
                                  >
                                    QR
                                  </button>
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="share-mini-btn whatsapp"
                                    title="Share on WhatsApp"
                                  >
                                    💬
                                  </a>
                                  <button
                                    type="button"
                                    className="share-mini-btn"
                                    title="Copy Link"
                                    onClick={() => handleCopyShareLink(m.shareToken)}
                                  >
                                    📋
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        style={{ flex: 1 }}
                        onClick={() => setSplitModalOpen(true)}
                      >
                        Adjust split
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        style={{ flex: 1 }}
                        onClick={() => splitApi.reload()}
                      >
                        ↻ Refresh
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="small subtle" style={{ margin: "0 0 12px" }}>
                      Split the cost equally among your squad with instant QR codes and share links.
                    </p>
                    <Button
                      size="sm"
                      variant="primary"
                      block
                      onClick={() => setSplitModalOpen(true)}
                    >
                      Split the bill
                    </Button>
                  </div>
                )}

                {/* Open Game Section */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  {openGameData ? (
                    <div>
                      <div className="between" style={{ marginBottom: 4 }}>
                        <b style={{ fontSize: 13 }}>📢 Open Game Active</b>
                        <span className="badge blue nodot">{openGameData.status}</span>
                      </div>
                      <p className="tiny subtle" style={{ margin: "0 0 8px" }}>
                        {openGameData.filledCount} of {openGameData.capacity} spots filled ({openGameData.spotsLeft} open for strangers).
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        block
                        to={paths.solo.game(openGameData.id)}
                      >
                        View Open Game Roster
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="between" style={{ marginBottom: 4 }}>
                        <b style={{ fontSize: 13 }}>Need extra players?</b>
                      </div>
                      <p className="tiny subtle" style={{ margin: "0 0 8px" }}>
                        Reserve spots for your squad and post the remaining spots as an open game.
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        block
                        onClick={() => setOpenGameDrawerOpen(true)}
                      >
                        Post open spots
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="pdf-cta">
              <div className="pdf-cta-head">
                <span className="pdf-cta-icon" aria-hidden="true">
                  📄
                </span>
                <span className="pdf-cta-text">
                  <b>Get your receipt</b>
                  <span>A full PDF copy of this booking, with a scannable ticket QR.</span>
                </span>
              </div>
              <div className="pdf-cta-actions">
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

      {/* Split Configuration Modal */}
      <Overlay
        isOpen={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        title="Split booking price"
        mode="modal"
      >
        <form onSubmit={handleEnableSplit} className="stack-sm">
          <p className="subtle small">
            Enter the number of players sharing this booking ({bdt(booking?.netAmount)}). Each player gets a shareable link &amp; QR code.
          </p>

          <Field label="Total number of players" htmlFor="split-players">
            <Input
              id="split-players"
              type="number"
              min="2"
              max="50"
              value={splitPlayerCount}
              onChange={(e) => setSplitPlayerCount(e.target.value)}
              required
            />
          </Field>

          {Number(splitPlayerCount) >= 2 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "rgba(34, 197, 94, 0.08)",
                border: "1px solid rgba(34, 197, 94, 0.2)",
                fontSize: 14,
                marginBottom: 10,
              }}
            >
              <div className="between">
                <span>Per person share:</span>
                <b className="num" style={{ color: "var(--brand)", fontSize: 16 }}>
                  {bdt(Math.round(Number(booking?.netAmount ?? 0) / Number(splitPlayerCount)))}
                </b>
              </div>
              <div className="tiny subtle" style={{ marginTop: 4 }}>
                Lock window: 24 hours or until kickoff, whichever is earlier.
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <Button
              type="button"
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => setSplitModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              style={{ flex: 1 }}
              loading={enablingSplit}
              disabled={enablingSplit}
            >
              {enablingSplit ? "Generating…" : "Generate Split"}
            </Button>
          </div>
        </form>
      </Overlay>

      {/* QR Code Viewer Modal */}
      <Overlay
        isOpen={Boolean(activeQrMember)}
        onClose={() => setActiveQrMember(null)}
        title="Scan to Pay Share"
        mode="modal"
      >
        {activeQrMember && (
          <div className="center stack-sm" style={{ padding: "8px 0" }}>
            <p className="subtle small">
              Ask your teammate to scan this QR code on their phone to complete payment.
            </p>

            <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
              <QrCode
                value={getShareUrl(activeQrMember.shareToken)}
                style={{ width: 180, height: 180 }}
                label="Share Payment QR Code"
              />
            </div>

            <div className="pay-share-amount-box" style={{ width: "100%", margin: "8px 0" }}>
              <span className="tiny subtle">AMOUNT DUE</span>
              <div className="pay-share-amount-val" style={{ fontSize: 24 }}>
                {bdt(activeQrMember.shareAmount)}
              </div>
            </div>

            <div className="row" style={{ gap: 8, width: "100%", marginTop: 10 }}>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Pay your share (${bdt(activeQrMember.shareAmount)}) for ${booking?.venueName}:\n${getShareUrl(activeQrMember.shareToken)}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-action-btn whatsapp"
                style={{ flex: 1 }}
              >
                💬 WhatsApp
              </a>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                onClick={() => handleCopyShareLink(activeQrMember.shareToken)}
              >
                📋 Copy Link
              </Button>
            </div>
          </div>
        )}
      </Overlay>

      {/* Create Open Game Drawer */}
      <CreateGameDrawer
        isOpen={openGameDrawerOpen}
        onClose={() => setOpenGameDrawerOpen(false)}
        defaultBookingId={bookingId}
        onCreated={() => {
          setOpenGameDrawerOpen(false);
          showToast("Open game posted successfully 📢");
          reloadBooking();
          splitApi.reload();
          openGameApi.reload();
        }}
      />
    </>
  );
}
