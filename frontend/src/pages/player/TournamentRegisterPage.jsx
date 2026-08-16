import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { BackButton } from '@/components/buttons/BackButton';
import { Button } from '@/components/buttons/Button';
import { Badge } from '@/components/ui/Badge';
import { useSession } from '@/hooks/useSession';
import { getTournamentDetail, registerForTournament } from '@/api/playerTournaments';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { DashCard, DashEmpty, DashError, DashSkeleton } from './dashboard/DashboardKit';
import './TournamentDetailPage.css';

const SKILL_LEVELS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

const bdt = (value) =>
  value == null ? null : `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

export default function TournamentRegisterPage() {
  const { code } = useParams();
  const { showToast } = useToast();

  const detail = useApi(() => getTournamentDetail(code), [code]);
  const me = useSession();
  const tournament = detail.data;

  const [form, setForm] = useState({
    teamName: '',
    captainName: '',
    contactPhone: '',
    emergencyContact: '',
    jerseyNumber: '',
    skillLevel: '',
    medicalNotes: '',
    agreedToRules: false,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);

  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (form.teamName.trim().length < 2) next.teamName = 'Give your team a name';
    if (form.contactPhone && !/^[+\d][\d\s-]{6,}$/.test(form.contactPhone)) {
      next.contactPhone = 'Enter a reachable phone number';
    }
    if (!form.agreedToRules) next.agreedToRules = 'You must accept the tournament rules';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const team = await registerForTournament(code, {
        ...form,
        teamName: form.teamName.trim(),
        captainName: form.captainName.trim() || (me.data?.fullName ?? ''),
        contactPhone: form.contactPhone.trim() || (me.data?.phone ?? ''),
      });
      setReceipt(team);
    } catch (error) {
      showToast(error.message ?? 'Registration failed — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  if (detail.loading) {
    return (
      <main className="wrap wrap-narrow" style={{ paddingTop: 24 }} id="main">
        <PageTitle title="Register" />
        <DashSkeleton rows={4} height={80} />
      </main>
    );
  }

  if (detail.error) {
    return (
      <main className="wrap wrap-narrow" style={{ paddingTop: 24 }} id="main">
        <PageTitle title="Register" />
        <DashCard>
          <DashError onRetry={detail.reload} message={detail.error.message} />
        </DashCard>
      </main>
    );
  }

  // ── Confirmation ─────────────────────────────────────────────────────
  if (receipt) {
    return (
      <>
        <PageTitle title="Registration confirmed" />
        <main className="wrap wrap-narrow" style={{ paddingTop: 24, paddingBottom: 48 }} id="main">
          <DashCard>
            <div className="dash-empty">
              <span className="dash-empty-ico" aria-hidden="true">
                🎟
              </span>
              <h3>You’re registered</h3>
              <p>
                <b>{receipt.name}</b> is entered into {tournament.name} on{' '}
                {formatDate(tournament.date)} at {tournament.venueName}.
              </p>
            </div>

            <div className="tdx-ticket">
              <div>
                <span>Registration code</span>
                <b className="num">{receipt.registrationCode}</b>
              </div>
              <div>
                <span>Entry fee</span>
                <b className="num">{bdt(tournament.entryFeePerTeam)}</b>
              </div>
              <div>
                <span>Payment</span>
                <Badge tone={receipt.entryFeeStatus === 'PAID' ? 'green' : 'amber'}>
                  {receipt.entryFeeStatus === 'PAID' ? 'Paid' : 'Due'}
                </Badge>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
              Online entry-fee payment isn’t live yet, so settle the fee directly with the
              organiser and quote your registration code. Your spot is held either way — you’ll see
              the status update here once it’s recorded.
            </p>

            <div className="stack-sm" style={{ marginTop: 14 }}>
              <Button block to={paths.player.tournament(code)}>
                View tournament
              </Button>
              <Button block variant="secondary" to={paths.player.dashboard.tournaments}>
                My tournaments
              </Button>
            </div>
          </DashCard>
        </main>
      </>
    );
  }

  // ── Already full / closed ────────────────────────────────────────────
  const spotsLeft = tournament.teamCapacity - tournament.teams.length;
  const closed =
    (tournament.status !== 'PUBLISHED' && tournament.status !== 'CONFIRMED') || spotsLeft <= 0;

  if (closed) {
    return (
      <main className="wrap wrap-narrow" style={{ paddingTop: 24 }} id="main">
        <PageTitle title="Register" />
        <BackButton to={paths.player.tournament(code)}>Tournament</BackButton>
        <DashCard>
          <DashEmpty
            icon="🚫"
            title={spotsLeft <= 0 ? 'This tournament is full' : 'Registration is closed'}
            actions={
              <Button size="sm" to={paths.player.dashboard.tournaments}>
                Browse other tournaments
              </Button>
            }
          >
            {spotsLeft <= 0
              ? `All ${tournament.teamCapacity} team spots have been taken.`
              : 'The organiser has closed registration for this tournament.'}
          </DashEmpty>
        </DashCard>
      </main>
    );
  }

  return (
    <>
      <PageTitle title={`Register · ${tournament.name}`} />
      <main className="wrap wrap-narrow" style={{ paddingTop: 20, paddingBottom: 48 }} id="main">
        <BackButton to={paths.player.tournament(code)}>{tournament.name}</BackButton>

        <h1 style={{ fontSize: 22, margin: '10px 0 4px' }}>Register your team</h1>
        <p style={{ margin: '0 0 18px', fontSize: 13.5, color: 'var(--text-3)' }}>
          {formatDate(tournament.date)} · {tournament.venueName} · {spotsLeft} spot
          {spotsLeft > 1 ? 's' : ''} left · entry {bdt(tournament.entryFeePerTeam)}
        </p>

        <form onSubmit={submit} noValidate>
          <DashCard title="Team">
            <div className="field">
              <label htmlFor="teamName">Team name *</label>
              <input
                className="input"
                id="teamName"
                value={form.teamName}
                onChange={set('teamName')}
                aria-invalid={Boolean(errors.teamName)}
                aria-describedby={errors.teamName ? 'teamName-error' : undefined}
                maxLength={100}
                required
              />
              {errors.teamName ? (
                <span id="teamName-error" className="hint" style={{ color: 'var(--danger)' }}>
                  {errors.teamName}
                </span>
              ) : null}
            </div>

            <div className="grid2">
              <div className="field">
                <label htmlFor="captainName">Captain</label>
                <input
                  className="input"
                  id="captainName"
                  value={form.captainName}
                  onChange={set('captainName')}
                  placeholder={me.data?.fullName ?? 'Your name'}
                  maxLength={100}
                />
              </div>
              <div className="field">
                <label htmlFor="contactPhone">Contact phone</label>
                <input
                  className="input"
                  id="contactPhone"
                  value={form.contactPhone}
                  onChange={set('contactPhone')}
                  placeholder={me.data?.phone ?? '+8801…'}
                  aria-invalid={Boolean(errors.contactPhone)}
                  maxLength={20}
                />
                {errors.contactPhone ? (
                  <span className="hint" style={{ color: 'var(--danger)' }}>
                    {errors.contactPhone}
                  </span>
                ) : null}
              </div>
            </div>
          </DashCard>

          <DashCard title="Player details" style={{ marginTop: 16 }}>
            <div className="grid2">
              <div className="field">
                <label htmlFor="jerseyNumber">Jersey number</label>
                <input
                  className="input"
                  id="jerseyNumber"
                  value={form.jerseyNumber}
                  onChange={set('jerseyNumber')}
                  maxLength={8}
                />
              </div>
              <div className="field">
                <label htmlFor="skillLevel">Skill level</label>
                <select
                  className="select"
                  id="skillLevel"
                  value={form.skillLevel}
                  onChange={set('skillLevel')}
                >
                  {SKILL_LEVELS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="emergencyContact">Emergency contact</label>
              <input
                className="input"
                id="emergencyContact"
                value={form.emergencyContact}
                onChange={set('emergencyContact')}
                placeholder="Name and phone number"
                maxLength={120}
              />
            </div>

            <div className="field">
              <label htmlFor="medicalNotes">Medical notes</label>
              <textarea
                className="input"
                id="medicalNotes"
                rows="3"
                style={{ resize: 'vertical' }}
                value={form.medicalNotes}
                onChange={set('medicalNotes')}
                placeholder="Anything the organiser should know (optional)"
                maxLength={500}
              />
            </div>
          </DashCard>

          <DashCard title="Entry fee & rules" style={{ marginTop: 16 }}>
            <div className="dash-rows">
              <div className="dash-row">
                <div className="dash-row-main">
                  <b>{bdt(tournament.entryFeePerTeam)} per team</b>
                  <span>Recorded as due — settled with the organiser</span>
                </div>
                <Badge tone="amber">Due</Badge>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '12px 0 0', lineHeight: 1.6 }}>
              Online payment isn’t available yet, so registering reserves your spot and records the
              fee as outstanding. Nothing is charged now.
            </p>

            <label className="checkline" style={{ marginTop: 14 }}>
              <input
                type="checkbox"
                checked={form.agreedToRules}
                onChange={set('agreedToRules')}
                aria-invalid={Boolean(errors.agreedToRules)}
              />
              <span>
                I accept the tournament rules, the venue rules and the organiser’s cancellation
                terms.
              </span>
            </label>
            {errors.agreedToRules ? (
              <span className="hint" style={{ color: 'var(--danger)' }}>
                {errors.agreedToRules}
              </span>
            ) : null}
          </DashCard>

          <div className="stack-sm" style={{ marginTop: 18 }}>
            <Button type="submit" variant="primary" block disabled={submitting}>
              {submitting ? 'Registering…' : 'Confirm registration'}
            </Button>
            <Link className="btn btn-tertiary btn-block" to={paths.player.tournament(code)}>
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
