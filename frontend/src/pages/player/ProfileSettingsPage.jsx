import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Input, Select } from '@/components/forms/Field';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/Skeleton';
import { getMyProfile, getSavedVenues, removeSavedVenue, updateMyProfile } from '@/api/players';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

const AREAS = ['Dhanmondi', 'Mohammadpur', 'Mirpur', 'Uttara', 'Banani', 'Baridhara', 'Lalmatia'];
const SPORTS = ['football', 'cricket', 'badminton', 'basketball', 'futsal'];
const TIMES = ['morning', 'afternoon', 'evening', 'late night', 'weekends'];
const SKILLS = ['beginner', 'intermediate', 'advanced'];

/** Account settings backed by GET/PATCH /api/v1/players/me. */
export default function ProfileSettingsPage() {
  const { showToast } = useToast();
  const profile = useApi(getMyProfile, []);
  const saved = useApi(getSavedVenues, []);

  if (profile.loading) {
    return (
      <main className="wrap-form" style={{ paddingTop: 40 }} id="main">
        <Skeleton height={420} radius={14} />
      </main>
    );
  }

  if (profile.error) {
    return (
      <>
        <PageTitle title="Profile settings" />
        <main className="wrap-form" style={{ paddingTop: 40 }} id="main">
          <h1 style={{ fontSize: 24 }}>Profile settings</h1>
          <p className="subtle">Could not load your profile — the server may be offline.</p>
          <Button variant="primary" onClick={profile.reload}>Retry</Button>
        </main>
      </>
    );
  }

  return (
    <ProfileForm
      initial={profile.data}
      savedVenues={saved.data ?? []}
      reloadSaved={saved.reload}
      showToast={showToast}
    />
  );
}

function ProfileForm({ initial, savedVenues, reloadSaved, showToast }) {
  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [area, setArea] = useState(initial.area ?? 'Dhanmondi');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [playStyle, setPlayStyle] = useState(initial.playStyle ?? 'intermediate');
  const [sports, setSports] = useState(() => new Set(initial.preferredSports ?? []));
  const [times, setTimes] = useState(() => new Set(initial.preferredTimes ?? []));
  const [saving, setSaving] = useState(false);

  const toggleIn = (setter) => (value) =>
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

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
      <main className="wrap-form" style={{ paddingTop: 40, paddingBottom: 64 }} id="main">
        <h1 style={{ fontSize: 24, marginBottom: 18 }}>Profile settings</h1>

        <div className="card" style={{ padding: 24 }}>
          <div className="field">
            <label htmlFor="ps-name">Full name</label>
            <Input id="ps-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div className="grid2">
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
                  <option key={option} value={option}>{option}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="ps-bio">Bio</label>
            <Input id="ps-bio" value={bio} maxLength={500} placeholder="Tell teammates about yourself"
              onChange={(event) => setBio(event.target.value)} />
          </div>
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
          <Button variant="primary" size="lg" block disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>

        <section className="section" style={{ marginTop: 28 }}>
          <div className="section-title">
            <h2>Saved venues</h2>
            <Link to={paths.player.explore}>Explore more →</Link>
          </div>
          {savedVenues.length === 0 ? (
            <p className="subtle">No saved venues yet — tap the heart on any venue to bookmark it.</p>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {savedVenues.map((venue) => (
                <div key={venue.slug} className="panel between" style={{ padding: '12px 16px' }}>
                  <Link to={paths.player.venue(venue.slug)} style={{ textDecoration: 'none', color: 'var(--text)' }}>
                    <b>{venue.name}</b>
                    <span className="subtle"> · {venue.area}</span>
                  </Link>
                  <Button size="sm" variant="tertiary" onClick={() => removeSaved(venue.slug, venue.name)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
