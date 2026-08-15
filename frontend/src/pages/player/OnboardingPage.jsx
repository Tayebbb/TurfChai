import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Input, Select } from '@/components/forms/Field';
import { Stepper } from '@/components/navigation/Stepper';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/cards/Card';
import { getMyProfile, updateMyProfile } from '@/api/players';
import { getUser } from '@/api/client';
import { useFilterChips } from '@/hooks/useFilterChips';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import {
  PLAYER_AREAS,
  PLAYER_SPORTS,
  PLAYER_TIMES,
  PLAYER_SKILLS,
  PLAYER_POSITIONS,
} from '@/constants/playerProfile';

const STEPS = [
  { id: 'about', label: '1. About you' },
  { id: 'style', label: '2. Play style' },
];

const ROLES = [
  { id: 'captain', title: 'Team Captain / Host', description: 'I book pitches for my team and split payments' },
  { id: 'solo', title: 'Solo Free Agent', description: 'I join open games and look for team alerts' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState('about');

  // Step 1: About you
  const localUser = getUser();
  const [name, setName] = useState(localUser?.fullName || '');
  const [area, setArea] = useState('');
  const sports = useFilterChips([]);
  const times = useFilterChips([]);
  const { toggle: toggleSport } = sports;
  const { toggle: toggleTime } = times;

  // Step 2: Play style
  const [role, setRole] = useState('');
  const [position, setPosition] = useState('');
  const skill = useFilterChips([]);
  const { toggle: toggleSkillChip } = skill;
  const [bio, setBio] = useState('');

  const [saving, setSaving] = useState(false);

  // Prefill profile from saved session or backend profile
  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (cancelled || !profile) return;
        if (profile.fullName) setName(profile.fullName);
        if (profile.area) setArea(profile.area.split(',')[0].trim());
        if (profile.playerRole) setRole(profile.playerRole);
        if (profile.position) setPosition(profile.position);
        (profile.preferredSports ?? []).forEach((value) => toggleSport(value));
        (profile.preferredTimes ?? []).forEach((value) => toggleTime(value));
        if (profile.playStyle) toggleSkillChip(profile.playStyle);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [toggleSport, toggleTime, toggleSkillChip]);

  const toggleSkill = (value) => {
    if (skill.isActive(value)) {
      skill.clear();
    } else {
      skill.clear();
      skill.toggle(value);
    }
  };

  const submitFinalProfile = async () => {
    if (!name.trim()) {
      showToast('Please enter your full name');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fullName: name.trim(),
        preferredSports: [...sports.active],
        preferredTimes: [...times.active],
      };
      if (area) payload.area = area;
      if (role) payload.playerRole = role;
      if (position) payload.position = position;
      const firstSkill = [...skill.active][0];
      if (firstSkill) payload.playStyle = firstSkill;

      await updateMyProfile(payload);
      showToast('Profile saved — Welcome to TurfChai!');
      navigate(paths.player.home);
    } catch (error) {
      showToast(error?.message ?? 'Could not save profile — please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle title="Set Up Your Player Profile" />
      <main className="wrap-form" style={{ paddingTop: 32, paddingBottom: 64 }} id="main">
        {/* Dynamic Stepper Header */}
        <div style={{ marginBottom: 24 }}>
          <Stepper items={STEPS} current={step} onStepChange={(stepId) => setStep(stepId)} />
        </div>

        <Card style={{ padding: 28, borderRadius: 20 }}>
          {/* STEP 1: ABOUT YOU */}
          {step === 'about' && (
            <div>
              <div className="between" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 1: About You</h2>
                <span className="subtle small">Personal Preferences</span>
              </div>
              <p className="subtle" style={{ marginBottom: 24 }}>
                We use this to show relevant turfs in your area and find match requests near you.
              </p>

              <div className="field">
                <label htmlFor="on-name">Full Name</label>
                <Input
                  id="on-name"
                  placeholder="e.g. Tanvir Hossain"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="on-loc">Home Area</label>
                <Select id="on-loc" value={area} onChange={(e) => setArea(e.target.value)}>
                  <option value="" disabled>Select your area</option>
                  {PLAYER_AREAS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
                <span className="hint">📍 Select your primary area in Dhaka</span>
              </div>

              <div className="field">
                <label>Sports You Play</label>
                <div className="row-wrap" style={{ marginTop: 6 }}>
                  {PLAYER_SPORTS.map((sport) => (
                    <Chip
                      key={sport.value}
                      active={sports.isActive(sport.value)}
                      onToggle={() => sports.toggle(sport.value)}
                    >
                      {sport.icon} {sport.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Preferred Play Schedule</label>
                <div className="row-wrap" style={{ marginTop: 6 }}>
                  {PLAYER_TIMES.map((time) => (
                    <Chip
                      key={time.value}
                      active={times.isActive(time.value)}
                      onToggle={() => times.toggle(time.value)}
                    >
                      {time.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                <Button
                  variant="primary"
                  size="lg"
                  block
                  onClick={() => {
                    if (!name.trim()) {
                      showToast('Please enter your full name');
                      return;
                    }
                    setStep('style');
                  }}
                >
                  Next: Play Style →
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: PLAY STYLE */}
          {step === 'style' && (
            <div>
              <div className="between" style={{ marginBottom: 12 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 2: Play Style & Tactics</h2>
                <span className="subtle small">Player Profile</span>
              </div>
              <p className="subtle" style={{ marginBottom: 24 }}>
                Let other players and venue hosts know your role and skill level when creating games.
              </p>

              <div className="field">
                <label>How Do You Play?</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 6 }}>
                  {ROLES.map((option) => (
                    <label
                      key={option.id}
                      className="panel"
                      style={{
                        cursor: 'pointer',
                        borderColor: role === option.id ? 'var(--brand)' : 'var(--border)',
                        background: role === option.id ? 'var(--brand-soft)' : 'var(--surface-2)',
                        padding: 14,
                        borderRadius: 14,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <input
                        type="radio"
                        name="role"
                        checked={role === option.id}
                        onChange={() => setRole(option.id)}
                        style={{ accentColor: 'var(--brand)', width: 18, height: 18, marginTop: 2 }}
                      />
                      <div>
                        <b style={{ fontSize: 14 }}>{option.title}</b>
                        <br />
                        <span className="subtle tiny" style={{ lineHeight: 1.4, display: 'block', marginTop: 4 }}>
                          {option.description}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="on-pos">Preferred Position</label>
                <Select id="on-pos" value={position} onChange={(e) => setPosition(e.target.value)}>
                  <option value="" disabled>Select your position</option>
                  {PLAYER_POSITIONS.map((pos) => (
                    <option key={pos.value} value={pos.value}>{pos.label}</option>
                  ))}
                </Select>
              </div>

              <div className="field">
                <label>Skill Level</label>
                <div className="row-wrap" style={{ marginTop: 6 }}>
                  {PLAYER_SKILLS.map((level) => (
                    <Chip
                      key={level.value}
                      active={skill.isActive(level.value)}
                      onToggle={() => toggleSkill(level.value)}
                    >
                      {level.label}
                    </Chip>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="on-bio">Player Bio / Notes (Optional)</label>
                <Input
                  id="on-bio"
                  placeholder="e.g. Loves fast counter-attacks & weekend night games"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                <Button variant="secondary" size="lg" onClick={() => setStep('about')}>
                  ← Back
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  block
                  disabled={saving}
                  onClick={submitFinalProfile}
                >
                  {saving ? 'Saving Profile…' : 'Complete Setup & Start Playing 🎉'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
