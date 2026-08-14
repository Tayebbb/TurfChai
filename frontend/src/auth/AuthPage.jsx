import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Card } from '@/components/cards/Card';
import { PageTitle } from '@/components/common/PageTitle';
import { Field, Input } from '@/components/forms/Field';
import { Tabs, TabPanel } from '@/components/navigation/Tabs';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { login, register } from '@/api/auth';
import { setSession } from '@/api/client';

const ROLE_TO_API = { player: 'PLAYER', owner: 'OWNER', admin: 'ADMIN' };

const ROLES = [
  {
    id: 'player',
    label: '⚽ Player',
    subtext: 'Book turfs & join games',
    tone: '#10B981',
  },
  {
    id: 'owner',
    label: '🏟️ Turf Owner',
    subtext: 'Manage pitches & payouts',
    tone: '#F59E0B',
  },
  {
    id: 'admin',
    label: '🛡️ Admin',
    subtext: 'Platform control & reviews',
    tone: '#3B82F6',
  },
];

const AUTH_TABS = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Create account' },
];

export default function AuthPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // set when a signed-out visitor hits an action that needs an identity
  const nextPath = searchParams.get('next');

  const [role, setRole] = useState('player');
  const [tab, setTab] = useState('signin');

  // Form states
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [venueName, setVenueName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeRoleConfig = ROLES.find((r) => r.id === role);

  /** Map the DB role (returned by the login API) to a redirect destination */
  const getDestinationByRole = (apiRole) => {
    if (nextPath && nextPath.startsWith('/')) return nextPath;
    if (apiRole === 'ADMIN') return paths.admin.dashboard;
    if (apiRole === 'OWNER') return paths.owner.dashboard;
    return paths.player.home;
  };

  const handleApiError = (error) => {
    showToast(error?.message || 'Something went wrong. Please try again.', { duration: 5000 });
    setIsSubmitting(false);
  };

  const handleQuickSubmit = async (e) => {
    e?.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = { email: signinEmail, password: signinPassword };
      const response = await login(payload);
      setSession(response);
      const dbRole = response?.user?.role ?? 'PLAYER';
      showToast(`Signed in successfully ✓`);
      navigate(getDestinationByRole(dbRole));
    } catch (error) {
      handleApiError(error);
    }
  };

  const handleSignupSubmit = async (e) => {
    e?.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await register({
        fullName,
        email: signupEmail,
        password: signupPassword,
        phone: `+880${Date.now() % 1000000000}`,
        role: ROLE_TO_API[role] ?? 'PLAYER',
      });
      setSession(response);
      showToast(`Account created! Welcome to TurfChai ✓`);
      if (nextPath && nextPath.startsWith('/')) navigate(nextPath);
      else if (role === 'admin') navigate(paths.admin.dashboard);
      else if (role === 'owner') navigate(paths.owner.onboarding);
      else navigate(paths.player.onboarding);
    } catch (error) {
      handleApiError(error);
    }
  };

  return (
    <>
      <PageTitle title="Authentication — TurfChai" />

      <div className="wrap-form" style={{ paddingTop: 36, paddingBottom: 64 }}>
        {/* Main Card Container */}
        <Card style={{ padding: 24, borderRadius: 20 }}>
          {/* Sign In vs Create Account Tabs */}
          <div style={{ marginBottom: 20 }}>
            <Tabs items={AUTH_TABS} value={tab} onChange={setTab} label="Authentication Mode" />
          </div>

          {/* SIGN IN TAB */}
          <TabPanel id="signin" value={tab}>
            <form onSubmit={handleQuickSubmit}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Welcome Back!</h2>
              <p className="subtle small" style={{ marginBottom: 18 }}>
                Sign in with your email and password to continue.
              </p>

              <Field label="Email Address" htmlFor="em">
                <Input
                  id="em"
                  type="email"
                  placeholder="user@example.com"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" htmlFor="pw">
                <Input
                  id="pw"
                  type="password"
                  placeholder="••••••••"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                />
              </Field>

              <Button variant="primary" block type="submit" style={{ marginTop: 8 }} disabled={isSubmitting}>
                {isSubmitting ? 'Working…' : 'Sign In →'}
              </Button>
            </form>

            <p className="subtle center tiny" style={{ marginTop: 16, marginBottom: 0 }}>
              <a
                href="#trouble"
                onClick={(e) => {
                  e.preventDefault();
                  showToast('Password reset link sent to your registered phone/email 📩');
                }}
              >
                Forgot credentials or need help?
              </a>
            </p>
          </TabPanel>

          {/* SIGN UP TAB */}
          <TabPanel id="signup" value={tab}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Create Your Account</h2>
            <p className="subtle small" style={{ marginBottom: 18 }}>
              Select your role to get started.
            </p>

            {/* Role Selector */}
            <div style={{ marginBottom: 18 }}>
              <div className="subtle tiny" style={{ fontWeight: 700, marginBottom: 6 }}>
                Select Account Role
              </div>
              <div className="seg glass" role="tablist" aria-label="Account Role Selection" style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 16 }}>
                {ROLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={role === item.id ? 'on' : undefined}
                    role="tab"
                    aria-selected={role === item.id}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      borderRadius: 12,
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => setRole(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="tiny subtle" style={{ marginTop: 6 }}>
                {activeRoleConfig?.subtext}
              </div>
            </div>

            <form onSubmit={handleSignupSubmit}>

              <Field label="Full Name" htmlFor="nm">
                <Input
                  id="nm"
                  placeholder="e.g. Mahfuzur Rahman"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>

              {role === 'owner' && (
                <Field label="Venue Name" htmlFor="vnm">
                  <Input
                    id="vnm"
                    placeholder="e.g. Dream Arena Turf"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                  />
                </Field>
              )}

              <Field label="Email Address" htmlFor="em2">
                <Input
                  id="em2"
                  type="email"
                  placeholder="user@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />
              </Field>
              <Field label="Create Password" htmlFor="pw2">
                <Input
                  id="pw2"
                  type="password"
                  placeholder="At least 8 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
              </Field>

              <Button variant="primary" block type="submit" style={{ marginTop: 8 }} disabled={isSubmitting}>
                {isSubmitting ? 'Working…' : `Register as ${activeRoleConfig?.label} →`}
              </Button>
            </form>

            <p className="subtle center tiny" style={{ marginTop: 16, marginBottom: 0 }}>
              By registering, you agree to TurfChai's terms of service and privacy policy.
            </p>
          </TabPanel>
        </Card>
      </div>
    </>
  );
}
