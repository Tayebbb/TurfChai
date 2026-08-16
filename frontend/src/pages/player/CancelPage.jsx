import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { Overlay } from "@/components/modals/Overlay";
import { getBooking } from "@/api/bookings";
import { getRefundPreview, cancelAndRefund } from "@/api/payments";
import { useApi } from "@/hooks/useApi";
import { useDisclosure } from "@/hooks/useDisclosure";
import { paths } from "@/routes/paths";

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

export default function CancelPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const navigate = useNavigate();
  const cancelled = useDisclosure(false);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState(null);

  const { data: booking, loading, error } = useApi(
    () => (bookingId ? getBooking(bookingId) : Promise.reject(new Error("No booking reference"))),
    [bookingId],
  );

  const previewApi = useApi(
    () => (bookingId ? getRefundPreview(bookingId) : Promise.resolve(null)),
    [bookingId],
  );

  const onConfirmCancel = async () => {
    setCancelling(true);
    try {
      const outcome = await cancelAndRefund(bookingId);
      setResult(outcome);
      cancelled.open();
    } catch (cancelError) {
      setResult({ error: cancelError.message || "Could not cancel this booking" });
      cancelled.open();
    } finally {
      setCancelling(false);
    }
  };

  if (!bookingId) {
    return (
      <>
        <PageTitle title="Cancel booking" />
        <main className="wrap-form" id="main" style={{ paddingTop: 40, paddingBottom: 64 }}>
          <h1 style={{ fontSize: 22 }}>No booking selected</h1>
          <p className="subtle">
            Open a booking from <Link to={paths.player.bookings}>My bookings</Link> and cancel it from there.
          </p>
        </main>
      </>
    );
  }

  if (loading || previewApi.loading) {
    return (
      <>
        <PageTitle title="Cancel booking" />
        <main className="wrap-form" id="main" style={{ paddingTop: 40, paddingBottom: 64 }}>
          <p className="subtle" role="status">
            Loading…
          </p>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageTitle title="Cancel booking" />
        <main className="wrap-form" id="main" style={{ paddingTop: 40, paddingBottom: 64 }}>
          <div className="card" style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, marginBottom: 6 }}>Could not load this booking</h1>
            <p className="subtle">{error.message}</p>
          </div>
        </main>
      </>
    );
  }

  const code = booking?.bookingCode || bookingId;
  const playTime =
    booking?.startTime && booking?.endTime
      ? `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
      : "—";
  const preview = previewApi.data;
  // PENDING is included: the backend allows cancelling it (it only rejects an
  // already-CANCELLED booking), and a PENDING booking has no successful
  // payment yet, so the refund preview below correctly computes ৳0 paid / ৳0
  // refund rather than needing different handling here.
  const canCancel = booking?.status === "CONFIRMED" || booking?.status === "PENDING";

  return (
    <>
      <PageTitle title="Cancel booking" />
      <main
        className="wrap-form"
        id="main"
        style={{ paddingTop: 32, paddingBottom: 64 }}
      >
        <h1 style={{ fontSize: 22 }}>Cancel booking {code}?</h1>
        <p className="subtle" style={{ marginBottom: 16 }}>
          {formatDate(booking?.bookingDate)} &middot; {playTime}
        </p>

        {!canCancel ? (
          <div className="alert warn">
            <span className="ico">⚠️</span>
            <div>This booking can no longer be cancelled (status: {booking?.status}).</div>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="panel">
                <b className="small">Refund calculation</b>
                <div className="pricerow">
                  <span>Amount paid</span>
                  <span className="num">{bdt(preview?.amountPaid ?? booking?.netAmount)}</span>
                </div>
                <div className="pricerow">
                  <span>Cancellation window</span>
                  <span>
                    <span className={preview?.refundPercent > 0 ? "badge green" : "badge"}>
                      {preview ? `${preview.refundPercent}% refundable` : "—"}
                    </span>
                  </span>
                </div>
                <div className="pricerow total">
                  <span>Refund amount</span>
                  <span className="num" style={{ color: "var(--brand-600)" }}>
                    {bdt(preview?.refundAmount)}
                  </span>
                </div>
              </div>

              <p className="subtle tiny" style={{ margin: "8px 0 0" }}>
                Refund is recorded immediately and returns to your original payment method within a
                few days, per this venue&apos;s cancellation policy.
              </p>
            </div>

            <div className="alert warn" style={{ marginTop: 14 }}>
              <span className="ico">⚠️</span>
              <div>
                <b>This releases your slot</b>It returns to live availability for other players.
              </div>
            </div>

            <div className="stack-sm" style={{ marginTop: 16 }}>
              <Button
                variant="danger"
                size="lg"
                block
                onClick={onConfirmCancel}
                loading={cancelling}
                disabled={cancelling}
              >
                Cancel booking &amp; refund {bdt(preview?.refundAmount)}
              </Button>
              <Button variant="secondary" block to={paths.player.bookingDetail(bookingId)}>
                Keep my booking
              </Button>
            </div>
          </>
        )}
      </main>

      <Overlay
        isOpen={cancelled.isOpen}
        onClose={cancelled.close}
        hideHeader
        title="Booking cancelled"
      >
        <div className="center">
          {result?.error ? (
            <>
              <h3>Could not cancel</h3>
              <p className="muted small">{result.error}</p>
            </>
          ) : (
            <>
              <div
                className="check-anim"
                style={{ background: "var(--info)" }}
                aria-hidden="true"
              >
                ↩
              </div>
              <h3>Booking cancelled</h3>
              <p className="muted small">
                {result?.refundAmount > 0 ? (
                  <>
                    Refund of <b className="num">{bdt(result.refundAmount)}</b> is on its way.
                  </>
                ) : (
                  "No refund applies under this venue's policy at this time."
                )}
              </p>
            </>
          )}
          <div className="stack-sm" style={{ marginTop: 14 }}>
            <Button variant="primary" block to={paths.player.explore}>
              Find another slot
            </Button>
            <Button variant="tertiary" block onClick={() => navigate(paths.player.bookings)}>
              Back to my bookings
            </Button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
