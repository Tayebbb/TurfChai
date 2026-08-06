import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Input, Select, Textarea } from '@/components/forms/Field';
import { Chip } from '@/components/ui/Chip';
import { getSavedVenues, removeSavedVenue, updateMyProfile } from '@/api/players';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { DashCard, DashEmpty, DashError, DashSkeleton } from './dashboard/DashboardKit';
import { profileCompletion } from './dashboard/sections';
import './ProfileSettingsPage.css';

const AREAS = ['Dhanmondi', 'Mohammadpur', 'Mirpur', 'Uttara', 'Banani', 'Baridhara', 'Lalmatia'];
const SPORTS = ['football', 'cricket', 'badminton', 'basketball', 'futsal'];
const TIMES = ['morning', 'afternoon', 'evening', 'late night', 'weekends'];
const SKILLS = ['beginner', 'intermediate', 'advanced'];
const BIO_MAX = 500;

/** Account settings backed by GET/PATCH /api/v1/players/me. */
export default function ProfileSettingsPage() {
  const { profile, profileState } = useOutletContext();
  const { showToast } = useToast();
  const saved = useApi(getSavedVenues, []);

  if (profileState.loading) {
    return (
      <>
        <PageTitle title="Profile settings" />
        <DashSkeleton rows={3} height={140} />
      </>
    );
  }

  if (profileState.error || !profile) {
    return (
      <>
        <PageTitle title="Profile settings" />
        <DashError message="Could not load your profile — the server may be offline." onRetry={profileState.reload} />
      </>
    );
  }

  return (
    <ProfileForm
      key={profile.publicId ?? profile.id}
      initial={profile}
      reloadProfile={profileState.reload}
      savedVenues={saved.data ?? []}
      savedLoading={saved.loading}
      reloadSaved={saved.reload}
      showToast={showToast}
    />
  );
}

function ProfileForm({ initial, reloadProfile, savedVenues, savedLoading, reloadSaved, showToast }) {
  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [area, setArea] = useState(initial.area ?? 'Dhanmondi');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [playStyle, setPlayStyle] = useState(initial.playStyle ?? 'intermediate');
  const [sports, setSports] = useState(() => new Set(initial.preferredSports ?? []));
  const [times, setTimes] = useState(() => new Set(initial.preferredTimes ?? []));
  const [saving, setSaving] = useState(false);

  const completion = profileCompletion(initial);

  const initials =
    initial.avatarInitials ||
    (initial.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') ||
    '·';

  const dirty = useMemo(() => {
    const sameSet = (set, list) =>
      set.size === (list?.length ?? 0) && [...set].every((value) => list.includes(value));
    return (
      fullName !== (initial.fullName ?? '') ||
      area !== (initial.area ?? 'Dhanmondi') ||
      bio !== (initial.bio ?? '') ||
      playStyle !== (initial.playStyle ?? 'intermediate') ||
      !sameSet(sports, initial.preferredSports ?? []) ||
      !sameSet(times, initial.preferredTimes ?? [])
    );
  }, [fullName, area, bio, playStyle, sports, times, initial]);

  const toggleIn = (setter) => (value) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const reset = () => {
    setFullName(initial.fullName ?? '');
    setArea(initial.area ?? 'Dhanmondi');
    setBio(initial.bio ?? '');
    setPlayStyle(initial.playStyle ?? 'intermediate');
    setSports(new Set(initial.preferredSports ?? []));
    setTimes(new Set(initial.preferredTimes ?? []));
  };

  const save = async () => {
    if (fullName.trim().length < 2) {
      showToast('Please enter your name');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        fullName: fullName.trim(),
        area,
        bio,
        playStyle,
        preferredSports: [...sports],
        preferredTimes: [...times],
      });
      showToast('✅ Profile updated');
      reloadProfile();
    } catch (error) {
      showToast(error.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const removeSaved = async (slug, name) => {
    try {
      await removeSavedVenue(slug);
      reloadSaved();
      showToast(`Removed ${name} from saved venues`);
    } catch {
      showToast('Could not update saved venues');
    }
  };

  return (
    <>
      <PageTitle title="Profile settings" />

      <section className="ps-hero">
        <div className="ps-hero-banner" aria-hidden="true" />
        <div className="ps-hero-body">
          <span className="ps-ring" style={{ '--pct': completion.percent }} aria-hidden="true">
            <span className="ps-avatar">{initials}</span>
          </span>
          <div className="ps-hero-text">
            <h1>{initial.fullName || 'Your profile'}</h1>
            <p>{initial.email}</p>
            <div className="ps-tags">
              {initial.area ? <span className="ps-tag">{initial.area}</span> : null}
              {initial.playStyle ? <span className="ps-tag">{initial.playStyle}</span> : null}
              {initial.reliabilityScore != null ? (
                <span className="ps-tag muted">{initial.reliabilityScore}% reliability</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="ps-progress">
          <div className="ps-progress-top">
            <span>Profile strength</span>
            <b>{completion.percent}%</b>
          </div>
          <div
            className="ps-progress-bar"
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion"
          >
            <i style={{ width: `${completion.percent}%` }} />
          </div>
          <p className="ps-missing">
            {completion.missing.length
              ? `Still missing ${completion.missing.join(', ')}.`
              : 'Your profile is complete — teammates can see everything.'}
          </p>
        </div>
      </section>

      <DashCard title="Basics">
        <p className="ps-legend">This is what other players see when you join a game.</p>

        <div className="field">
          <label htmlFor="ps-name">Full name</label>
          <Input id="ps-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </div>

        <div className="ps-grid">
          <div className="field">
            <label htmlFor="ps-area">Home area</label>
            <Select id="ps-area" value={area} onChange={(event) => setArea(event.target.value)}>
              {AREAS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="ps-skill">Skill level</label>
            <Select id="ps-skill" value={playStyle} onChange={(event) => setPlayStyle(event.target.value)}>
              {SKILLS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="field">
          <label htmlFor="ps-bio">Bio</label>
          <Textarea
            id="ps-bio"
            className="ps-bio"
            value={bio}
            maxLength={BIO_MAX}
            placeholder="Tell teammates about yourself — the position you play, how often you're free, anything else."
            onChange={(event) => setBio(event.target.value)}
          />
          <span className="ps-count">
            {bio.length} / {BIO_MAX}
          </span>
        </div>
      </DashCard>

      <DashCard title="Playing preferences">
        <p className="ps-legend">We use these to rank venues and open games for you.</p>

        <div className="field">
          <label>Sports you play</label>
          <div className="row-wrap">
            {SPORTS.map((sport) => (
              <Chip key={sport} active={sports.has(sport)} onToggle={() => toggleIn(setSports)(sport)}>
                {sport}
              </Chip>
            ))}
          </div>
        </div>

        <div className="field">
          <label>When you usually play</label>
          <div className="row-wrap">
            {TIMES.map((time) => (
              <Chip key={time} active={times.has(time)} onToggle={() => toggleIn(setTimes)(time)}>
                {time}
              </Chip>
            ))}
          </div>
        </div>
      </DashCard>

      <div className="ps-savebar">
        <span className="ps-savebar-note">{dirty ? 'You have unsaved changes' : 'Everything is saved'}</span>
        <div className="ps-savebar-actions">
          <Button variant="tertiary" disabled={!dirty || saving} onClick={reset}>
            Discard
          </Button>
          <Button variant="primary" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <DashCard title="Saved venues" action={<Link to={paths.player.explore}>Explore more →</Link>}>
        {savedLoading ? (
          <DashSkeleton rows={2} height={54} />
        ) : savedVenues.length === 0 ? (
          <DashEmpty icon="❤" title="No saved venues yet">
            Tap the heart on any venue to bookmark it here.
          </DashEmpty>
        ) : (
          <div className="dash-rows">
            {savedVenues.map((venue) => (
              <div key={venue.slug} className="dash-row">
                <Link
                  className="dash-row-main"
                  to={paths.player.venue(venue.slug)}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <b>{venue.name}</b>
                  <span>{venue.area}</span>
                </Link>
                <Button size="sm" variant="tertiary" onClick={() => removeSaved(venue.slug, venue.name)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </DashCard>
    </>
  );
}
