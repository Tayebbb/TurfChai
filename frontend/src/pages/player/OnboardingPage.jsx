import { useState } from 'react';
import { PageTitle } from '@/components/common/PageTitle';
import { Button } from '@/components/buttons/Button';
import { Input, Select } from '@/components/forms/Field';
import { Stepper } from '@/components/navigation/Stepper';
import { Chip } from '@/components/ui/Chip';
import { currentPlayer } from '@/data/users';
import { useFilterChips } from '@/hooks/useFilterChips';
import { paths } from '@/routes/paths';

const STEPS = [
  { id: 'verify', label: 'Verify' },
  { id: 'about', label: 'About you' },
  { id: 'style', label: 'Play style' },
];

const AREAS = [
  'Dhanmondi',
  'Mohammadpur',
  'Mirpur DOHS',
  'Uttara',
  'Banani',
  'Baridhara',
  'Bashundhara R/A',
];

const SPORTS = ['⚽ Football', '🏏 Cricket', '🏸 Badminton', '🏀 Basketball', '🎾 Futsal'];
const TIMES = ['Morning', 'Afternoon', 'Evening', 'Late night', 'Weekends'];
const SKILLS = ['Beginner', 'Intermediate', 'Advanced'];

const ROLES = [
  { id: 'captain', title: 'Team captain', description: 'I book for my team and split payments' },
  { id: 'solo', title: 'Solo player', description: 'I join open games as a free agent' },
];

export default function OnboardingPage() {
  const [step] = useState('about');
  const [name, setName] = useState(currentPlayer.name);
  const [area, setArea] = useState('Dhanmondi');
  const [role, setRole] = useState('captain');
  const sports = useFilterChips(['⚽ Football', '🏏 Cricket']);
  const times = useFilterChips(['Evening', 'Late night', 'Weekends']);
  const skill = useFilterChips(['Intermediate']);

  return (
    <>
      <PageTitle title="Set up your profile" />
      <main className="wrap-form" style={{ paddingTop: 40, paddingBottom: 64 }} id="main">
        <Stepper items={STEPS} current={step} />

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 20 }}>Quick setup — 30 seconds</h2>
          <p className="subtle" style={{ marginBottom: 18 }}>
            We use this to show the right venues and games first. You can change it anytime.
          </p>

          <div className="field">
            <label htmlFor="on-name">Your name</label>
            <Input id="on-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="on-loc">Home area</label>
            <Select id="on-loc" value={area} onChange={(event) => setArea(event.target.value)}>
              {AREAS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </Select>
            <span className="hint">📍 Detected from your location — tap to change</span>
          </div>

          <div className="field">
            <label>Sports you play</label>
            <div className="row-wrap">
              {SPORTS.map((sport) => (
                <Chip
                  key={sport}
                  active={sports.isActive(sport)}
                  onToggle={() => sports.toggle(sport)}
                >
                  {sport}
                </Chip>
              ))}
            </div>
          </div>

          <div className="field">
            <label>When do you usually play?</label>
            <div className="row-wrap">
              {TIMES.map((time) => (
                <Chip key={time} active={times.isActive(time)} onToggle={() => times.toggle(time)}>
                  {time}
                </Chip>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Skill level</label>
            <div className="row-wrap">
              {SKILLS.map((level) => (
                <Chip
                  key={level}
                  active={skill.isActive(level)}
                  onToggle={() => skill.toggle(level)}
                >
                  {level}
                </Chip>
              ))}
            </div>
          </div>

          <div className="field">
            <label>How do you play?</label>
            <div className="grid2">
              {ROLES.map((option) => (
                <label key={option.id} className="panel row" style={{ cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="role"
                    checked={role === option.id}
                    onChange={() => setRole(option.id)}
                    style={{ accentColor: 'var(--brand)', width: 18, height: 18 }}
                  />
                  <span>
                    <b>{option.title}</b>
                    <br />
                    <span className="subtle">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button variant="primary" size="lg" block to={paths.player.home}>
            Start playing →
          </Button>
        </div>
      </main>
    </>
  );
}
