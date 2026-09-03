import { useCallback, useState } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/buttons/Button';
import { Chip } from '@/components/ui/Chip';
import { Field, Input } from '@/components/forms/Field';
import { Overlay } from '@/components/modals/Overlay';
import { TableScroll } from '@/components/tables/TableScroll';
import { useApi } from '@/hooks/useApi';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { getUser } from '@/api/client';
import { listPayouts, getPayout, settlePayout, flagPayout } from '@/api/payouts';
import { toUserMessage } from '@/utils/errorMessage';
import { downloadCsv } from '@/utils/deviceActions';

const STATUS_FILTERS = ['PENDING', 'SETTLED', 'FLAGGED', 'ALL'];

const STATUS_TONE = {
  SETTLED: 'green',
  PENDING: 'amber',
  FLAGGED: 'red',
};

const bdt = (value) =>
  value == null ? '—' : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/**
 * Owner payout queue.
 *
 * The list, detail, settle and flag endpoints all existed already; nothing in
 * the console called them beyond summing settled payouts into a KPI. Settling
 * is restricted to SUPER_ADMIN on the server, so the button says so rather than
 * failing with a 403 after the click.
 */
export default function PayoutsPage() {
  const { showToast } = useToast();
  const detail = useDisclosure(false);
  const flagModal = useDisclosure(false);

  const [status, setStatus] = useState('PENDING');
  const [selected, setSelected] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [busy, setBusy] = useState(null);

  const isSuperAdmin = getUser()?.role === 'SUPER_ADMIN';

  const fetchPayouts = useCallback(
    () => listPayouts(status === 'ALL' ? undefined : status),
    [status],
  );
  const { data, loading, error, reload } = useApi(fetchPayouts, [status]);
  const payouts = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

  const openDetail = async (payout) => {
    setSelected(payout);
    detail.open();
    try {
      const full = await getPayout(payout.payoutCode);
      setSelected(full?.data ?? full ?? payout);
    } catch {
      // The row we already have is enough to act on; the drawer just shows less.
    }
  };

  const runSettle = async (payout) => {
    if (busy) return;
    setBusy(payout.payoutCode);
    try {
      await settlePayout(payout.payoutCode);
    } catch (err) {
      showToast(toUserMessage(err, 'Could not settle this payout.'));
      return;
    } finally {
      setBusy(null);
    }
    detail.close();
    reload();
    showToast(`${payout.payoutCode} settled ✓`);
  };

  // Releasing money needs the same confirmation every other destructive
  // action gets — amount and target named in the dialog.
  const [confirmSettle, setConfirmSettle] = useState(false);

  const submitFlag = async () => {
    const reason = flagReason.trim();
    if (!selected || !reason || busy) return;
    setBusy(selected.payoutCode);
    try {
      await flagPayout(selected.payoutCode, reason);
    } catch (err) {
      showToast(toUserMessage(err, 'Could not flag this payout.'));
      return;
    } finally {
      setBusy(null);
    }
    flagModal.close();
    detail.close();
    setFlagReason('');
    reload();
    showToast(`${selected.payoutCode} flagged for review`);
  };

  const exportCsv = () => {
    downloadCsv(
      `payouts-${status.toLowerCase()}.csv`,
      ['Code', 'Status', 'Gross', 'Platform fee', 'Net', 'Period start', 'Period end', 'Scheduled', 'Settled at'],
      payouts.map((payout) => [
        payout.payoutCode,
        payout.status,
        payout.grossAmount,
        payout.platformFee,
        payout.netAmount,
        payout.periodStart ?? '',
        payout.periodEnd ?? '',
        payout.scheduledDate ?? '',
        payout.settledAt ?? '',
      ]),
    );
    showToast(`Exported ${payouts.length} payout${payouts.length === 1 ? '' : 's'} ✓`);
  };

  const totalNet = payouts.reduce((sum, payout) => sum + (Number(payout.netAmount) || 0), 0);

  return (
    <>
      <PageTitle title="Payouts" />

      <div className="main-header">
        <div>
          <h1>Payouts</h1>
          <span className="subtle small">
            Owner settlements — review anomalies before releasing money
          </span>
        </div>
        <Button
          variant="secondary"
          disabled={payouts.length === 0}
          title={payouts.length === 0 ? 'Nothing to export' : undefined}
          onClick={exportCsv}
        >
          ⬇ Export CSV
        </Button>
      </div>

      <div className="row-wrap" style={{ marginBottom: 16 }}>
        {STATUS_FILTERS.map((option) => (
          <Chip key={option} active={status === option} onToggle={() => setStatus(option)}>
            {option === 'ALL' ? 'All' : option.charAt(0) + option.slice(1).toLowerCase()}
          </Chip>
        ))}
      </div>

      <div className="grid3" style={{ gap: 12, marginBottom: 16 }}>
        <div className="panel center">
          <b className="num" style={{ fontSize: 22 }}>{payouts.length}</b>
          <div className="tiny subtle">Payouts shown</div>
        </div>
        <div className="panel center">
          <b className="num" style={{ fontSize: 22 }}>{bdt(totalNet)}</b>
          <div className="tiny subtle">Net value</div>
        </div>
        <div className="panel center">
          <b className="num" style={{ fontSize: 22 }}>
            {payouts.filter((payout) => payout.anomalyFlag).length}
          </b>
          <div className="tiny subtle">Flagged anomalies</div>
        </div>
      </div>

      {/* Bare table broke the page on mobile — every other console table
          scrolls inside TableScroll. */}
      <TableScroll label="Payouts" className="card" style={{ padding: 0, marginBottom: 16 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Period</th>
            <th>Gross</th>
            <th>Fee</th>
            <th>Net</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.payoutCode}>
              <td className="num">{payout.payoutCode}</td>
              <td className="small">
                {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
              </td>
              <td className="num">{bdt(payout.grossAmount)}</td>
              <td className="num">{bdt(payout.platformFee)}</td>
              <td className="num">{bdt(payout.netAmount)}</td>
              <td>
                <Badge tone={STATUS_TONE[payout.status] ?? 'gray'}>{payout.status === 'ALL' ? 'All' : payout.status.charAt(0) + payout.status.slice(1).toLowerCase()}</Badge>
                {payout.anomalyFlag ? (
                  <Badge tone="red" dot={false} style={{ marginLeft: 4 }}>
                    ⚠ anomaly
                  </Badge>
                ) : null}
              </td>
              <td style={{ textAlign: 'right' }}>
                <Button size="sm" variant="tertiary" onClick={() => openDetail(payout)}>
                  Review
                </Button>
              </td>
            </tr>
          ))}
          {!loading && payouts.length === 0 ? (
            <tr>
              <td colSpan={7} className="center subtle small" style={{ padding: '32px 0' }}>
                {error ? (
                  <>
                    {toUserMessage(error, 'Could not load payouts.')}{' '}
                    <Button size="sm" variant="secondary" style={{ marginLeft: 8 }} onClick={reload}>
                      Try again
                    </Button>
                  </>
                ) : (
                  `No ${status === 'ALL' ? '' : status.toLowerCase() + ' '}payouts.`
                )}
              </td>
            </tr>
          ) : null}
          {loading ? (
            <tr>
              <td colSpan={7} className="center subtle small" style={{ padding: '32px 0' }}>
                Loading payouts…
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      </TableScroll>

      <Overlay
        isOpen={detail.isOpen}
        onClose={detail.close}
        title={`Payout ${selected?.payoutCode ?? ''}`}
        mode="drawer"
      >
        <div className="stack-sm" style={{ padding: '0 16px 16px' }}>
          <div className="panel">
            <div className="between small">
              <span className="muted">Gross</span>
              <b className="num">{bdt(selected?.grossAmount)}</b>
            </div>
            <div className="between small">
              <span className="muted">Platform fee</span>
              <b className="num">{bdt(selected?.platformFee)}</b>
            </div>
            <div className="between small">
              <span className="muted">Net to owner</span>
              <b className="num">{bdt(selected?.netAmount)}</b>
            </div>
            <div className="between small">
              <span className="muted">Scheduled</span>
              <b>{formatDate(selected?.scheduledDate)}</b>
            </div>
            <div className="between small">
              <span className="muted">Settled</span>
              <b>{selected?.settledAt ? formatDate(selected.settledAt) : 'Not yet'}</b>
            </div>
          </div>

          {selected?.anomalyFlag ? (
            <div className="alert warn">
              <span className="ico">⚠️</span>
              <div className="small">{selected.anomalyReason || 'Flagged for review.'}</div>
            </div>
          ) : null}

          <Button
            variant="primary"
            block
            disabled={!isSuperAdmin || selected?.status === 'SETTLED' || busy !== null}
            onClick={() => setConfirmSettle(true)}
          >
            {busy === selected?.payoutCode ? 'Working…' : '✓ Settle payout'}
          </Button>
          {!isSuperAdmin ? (
            // title attributes are hover-only; the reason must be visible.
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>
              Only a super admin can release a payout.
            </p>
          ) : null}

          <Button
            variant="ghostDanger"
            block
            disabled={busy !== null}
            onClick={() => {
              setFlagReason('');
              flagModal.open();
            }}
          >
            ⚠ Flag for review
          </Button>
        </div>
      </Overlay>

      <Overlay isOpen={flagModal.isOpen} onClose={flagModal.close} title="Flag payout" mode="modal">
        <div className="stack-sm" style={{ padding: '0 16px 16px' }}>
          <Field label="Reason" htmlFor="flagReason" hint="Recorded against the payout for the audit trail.">
            <Input
              id="flagReason"
              value={flagReason}
              placeholder="e.g. gross does not match booking ledger"
              onChange={(event) => setFlagReason(event.target.value)}
            />
          </Field>
          <Button variant="primary" block disabled={!flagReason.trim() || busy !== null} onClick={submitFlag}>
            {busy ? 'Flagging…' : 'Flag payout'}
          </Button>
        </div>
      </Overlay>

      {/* Settle confirmation — releasing money must never be one click. */}
      <Overlay
        isOpen={confirmSettle}
        onClose={() => setConfirmSettle(false)}
        title="Release this payout?"
        maxWidth={440}
      >
        <p style={{ margin: '0 0 12px', lineHeight: 1.5 }}>
          Release <strong>{bdt(selected?.netAmount)}</strong> (owner #{selected?.ownerUserId}, venue #{selected?.venueId}) for payout{' '}
          <strong>{selected?.payoutCode}</strong>?
        </p>
        <p className="subtle small" style={{ margin: '0 0 20px' }}>
          This marks the payout settled and is logged to the audit trail. It cannot be undone from
          the console.
        </p>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
          <Button size="sm" variant="secondary" onClick={() => setConfirmSettle(false)}>
            Not yet
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={busy !== null}
            onClick={async () => {
              setConfirmSettle(false);
              await runSettle(selected);
            }}
          >
            Yes, release {bdt(selected?.netAmount)}
          </Button>
        </div>
      </Overlay>
    </>
  );
}
