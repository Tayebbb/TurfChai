import { useMemo, useState } from "react";
import { PageTitle } from "@/components/common/PageTitle";
import { Button } from "@/components/buttons/Button";
import { TabPanel, Tabs } from "@/components/navigation/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { Photo } from "@/components/ui/Photo";
import { SkeletonList } from "@/components/ui/Skeleton";
import {
  downloadBookingPdf,
  formatBookingDate,
  formatTimeRange,
  groupBookings,
  listBookings,
} from "@/api/bookings";
import { useApi } from "@/hooks/useApi";
import { useToast } from "@/hooks/useToast";
import { paths } from "@/routes/paths";
import { formatBdt } from "@/utils/format";
import { toUserMessage } from "@/utils/errorMessage";

const THUMB_STYLE = { width: 56, height: 56, fontSize: 22, flex: "none" };

/** Tab metadata keyed by the group `groupBookings` produces. */
const GROUPS = {
  upcoming: {
    id: "up",
    title: "Upcoming",
    badge: { label: "Confirmed", className: "badge green" },
    empty: {
      glyph: "📅",
      title: "No upcoming bookings",
      description: "Book a slot and it shows up here with your check-in code.",
    },
  },
  pending: {
    id: "pend",
    title: "Pending payment",
    badge: { label: "Pending payment", className: "badge amber" },
    thumb: "alt1",
    empty: {
      glyph: "⏳",
      title: "Nothing awaiting payment",
      description: "Bookings that are not confirmed yet appear here.",
    },
  },
  completed: {
    id: "done",
    title: "Completed",
    badge: { label: "Completed", className: "badge green" },
    thumb: "alt2",
    empty: {
      glyph: "🏁",
      title: "No matches played yet",
      description: "Once a booking finishes it moves here so you can review it.",
    },
  },
  cancelled: {
    id: "canc",
    title: "Cancelled",
    badge: { label: "Cancelled", className: "badge gray" },
    thumb: "alt3",
    empty: {
      glyph: "🚫",
      title: "No cancelled bookings",
      description: "Bookings you cancel are kept here for your records.",
    },
  },
};

const GROUP_KEYS = Object.keys(GROUPS);

function BookingCard({ booking, groupKey }) {
  const group = GROUPS[groupKey];
  const { showToast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const title =
    [booking.venueName, booking.pitchName].filter(Boolean).join(" · ") || "Booking";
  const when = `${formatBookingDate(booking)} · ${formatTimeRange(booking.startTime, booking.endTime)}`;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await downloadBookingPdf(booking);
    } catch (downloadError) {
      showToast(toUserMessage(downloadError, "Could not download the PDF. Please try again."));
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="card">
      <div className="between" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="row">
          <Photo variant={group.thumb} style={THUMB_STYLE} glyph="⚽" />
          <div>
            <b>{title}</b>
            <div className="subtle small">
              {when} · Ref {booking.bookingCode ?? `#${booking.id}`}
            </div>
            <div className="row-wrap" style={{ marginTop: 4 }}>
              <span className={group.badge.className}>{group.badge.label}</span>
              {booking.amount != null ? (
                <span className="badge blue nodot">{formatBdt(booking.amount)}</span>
              ) : null}
              {booking.venueArea ? (
                <span className="badge gray nodot">{booking.venueArea}</span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="row-wrap">
          {groupKey === "upcoming" ? (
            <Button
              size="sm"
              variant="secondary"
              to={paths.player.matchdayFor(booking.id)}
            >
              Match-day ticket
            </Button>
          ) : null}
          {groupKey === "completed" ? (
            <Button size="sm" variant="secondary" to={paths.player.reviewFor(booking.id)}>
              Leave review
            </Button>
          ) : null}
          {groupKey === "upcoming" || groupKey === "pending" ? (
            <Button
              size="sm"
              variant="ghostDanger"
              to={paths.player.cancelFor(booking.id)}
            >
              Cancel
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            loading={downloadingPdf}
            onClick={handleDownloadPdf}
          >
            Download PDF
          </Button>
          <Button
            size="sm"
            variant="primary"
            to={paths.player.bookingDetail(booking.id)}
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const [tab, setTab] = useState(GROUPS.upcoming.id);
  const { data, loading, error, reload } = useApi(() => listBookings(), []);

  const groups = useMemo(() => groupBookings(data), [data]);

  const tabs = GROUP_KEYS.map((key) => ({
    id: GROUPS[key].id,
    label: `${GROUPS[key].title} (${groups[key].length})`,
  }));

  if (error) {
    const unauthorized = error.status === 401;
    return (
      <>
        <PageTitle title="My bookings" />
        <main className="wrap" id="main" style={{ paddingTop: 24, maxWidth: 860 }}>
          <h1 style={{ fontSize: 24 }}>My bookings</h1>
          <div className="card" style={{ padding: 20 }}>
            <b>
              {unauthorized
                ? "Sign in to see your bookings"
                : "Could not load your bookings"}
            </b>
            <p className="subtle small" style={{ margin: "6px 0 12px" }}>
              {error.message}
            </p>
            {unauthorized ? (
              <Button size="sm" variant="primary" to={paths.auth}>
                Sign in
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={reload}>
                Try again
              </Button>
            )}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageTitle title="My bookings" />
      <main
        className="wrap"
        id="main"
        style={{ paddingTop: 24, maxWidth: 860 }}
      >
        <h1 style={{ fontSize: 24 }}>My bookings</h1>

        <Tabs
          items={tabs}
          value={tab}
          onChange={setTab}
          label="Booking status"
        />

        {loading ? (
          <div style={{ marginTop: 12 }}>
            <SkeletonList count={3} height={96} />
          </div>
        ) : (
          GROUP_KEYS.map((key) => (
            <TabPanel id={GROUPS[key].id} value={tab} key={key}>
              {groups[key].length ? (
                <div className="stack">
                  {groups[key].map((booking) => (
                    <BookingCard
                      booking={booking}
                      groupKey={key}
                      key={booking.id}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  glyph={GROUPS[key].empty.glyph}
                  title={GROUPS[key].empty.title}
                  description={GROUPS[key].empty.description}
                  action={
                    <Button variant="primary" size="sm" to={paths.player.explore}>
                      Find a slot
                    </Button>
                  }
                />
              )}
            </TabPanel>
          ))
        )}
      </main>
    </>
  );
}
