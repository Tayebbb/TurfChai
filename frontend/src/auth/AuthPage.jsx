import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Card } from '@/components/cards/Card';
import { PageTitle } from '@/components/common/PageTitle';
import { Field, Input, InputRow } from '@/components/forms/Field';
import { OtpInput } from '@/components/forms/OtpInput';
import { Overlay } from '@/components/modals/Overlay';
import { Tabs, TabPanel } from '@/components/navigation/Tabs';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';

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

const ROLE_COPY = {
  player: {
    siTitle: 'Welcome Back, Player!',
    siSub: 'Sign in with your phone or email to manage your pitch bookings and matches.',
    suTitle: 'Join TurfChai as a Player',
    suSub: 'One account for turf booking, finding open games, and earning rewards.',
    perks: ['Instant online slot booking', 'Join community match games', 'Earn loyalty points'],
  },
  owner: {
    siTitle: 'Welcome Back, Turf Manager!',
    siSub: 'Sign in to manage your venue calendar, pricing, bookings, and payouts.',
    suTitle: 'List Your Turf Venue',
    suSub: 'Create a venue owner account to start listing your pitches and receiving bookings.',
    perks: ['Real-time slot calendar manager', 'QR code entry gates', 'Automated split payouts'],
  },
  admin: {
    siTitle: 'Administrator Control Center',
    siSub: 'Sign in with your administrator credentials to access platform governance.',
    suTitle: 'Request Admin Account',
    suSub: 'Submit an administrator access request for TurfChai platform management.',
    perks: ['Review venue onboarding requests', 'Platform revenue analytics', 'User & turf access control'],
  },
};

const GOOGLE_ICON = (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.7-.2-2.5H12v4.7h6.5c-.3 1.5-1.1 2.8-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
    <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1C3.2 21.3 7.3 24 12 24z" />
    <path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.2C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4.1-3.1z" />
    <path fill="#EA4335" d="M12 4.7c1.8 0 3.3.6 4.6 1.8L20 3C18 1.1 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4.1 3.1c.9-2.9 3.6-5 6.7-5z" />
  </svg>
);

export default function AuthPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const otpModal = useDisclosure();

  const [role, setRole] = useState('player');
  const [tab, setTab] = useState('signin');
  const [authMethod, setAuthMethod] = useState('phone'); // 'phone' | 'email'
  const [code, setCode] = useState('4810');

  // Form states
  const [signinDial, setSigninDial] = useState('+880');
  const [signinPhone, setSigninPhone] = useState('');
  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [signupDial, setSignupDial] = useState('+880');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [venueName, setVenueName] = useState('');

  const copy = ROLE_COPY[role];
  const activeRoleConfig = ROLES.find((r) => r.id === role);

  /** Calculate target destination based on selected role */
  const getDestination = () => {
    if (role === 'admin') return paths.admin.dashboard;
    if (role === 'owner') return tab === 'signup' ? paths.owner.onboarding : paths.owner.dashboard;
    return tab === 'signup' ? paths.player.onboarding : paths.player.home;
  };

  const handleQuickSubmit = (e) => {
    e?.preventDefault();
    if (authMethod === 'phone') {
      otpModal.open();
    } else {
      const dest = getDestination();
      showToast(`Signed in successfully as ${activeRoleConfig?.label} ✓`);
      navigate(dest);
    }
  };

  const handleOtpVerify = () => {
    otpModal.close();
    const dest = getDestination();
    showToast(`Verification successful! Welcome to TurfChai ✓`);
    navigate(dest);
  };

  return (
    <>
      <PageTitle title="Authentication — TurfChai" />

      <div className="wrap-form" style={{ paddingTop: 36, paddingBottom: 64, maxWidth: 480, margin: '0 auto' }}>
        {/* Role Selection Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>Select Account Role</h1>
          <p className="subtle small" style={{ margin: 0 }}>
            Choose your role to customize your login experience
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div
          className="seg glass"
          role="tablist"
          aria-label="Account Role Selection"
          style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 16, marginBottom: 20 }}
        >
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

        {/* Selected Role Banner */}
        <div
          style={{
            background: `color-mix(in srgb, ${activeRoleConfig?.tone} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${activeRoleConfig?.tone} 35%, transparent)`,
            borderRadius: 16,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: activeRoleConfig?.tone }}>
              Active Role: {activeRoleConfig?.label}
            </span>
            <div className="tiny subtle" style={{ marginTop: 2 }}>
              {activeRoleConfig?.subtext}
            </div>
          </div>
          <span className="badge" style={{ background: activeRoleConfig?.tone, color: '#fff', fontWeight: 700 }}>
            {role.toUpperCase()}
          </span>
        </div>

        {/* Main Card Container */}
        <Card style={{ padding: 24, borderRadius: 20 }}>
          {/* Sign In vs Create Account Tabs */}
          <div style={{ marginBottom: 20 }}>
            <Tabs items={AUTH_TABS} value={tab} onChange={setTab} label="Authentication Mode" />
          </div>

          {/* Auth Method Selector (Phone vs Email) */}
          <div className="row" style={{ gap: 8, marginBottom: 18 }}>
            <button
              type="button"
              className={`btn btn-sm ${authMethod === 'phone' ? 'btn-primary' : 'btn-tertiary'}`}
              style={{ flex: 1, fontSize: 13 }}
              onClick={() => setAuthMethod('phone')}
            >
              📱 Mobile OTP
            </button>
            <button
              type="button"
              className={`btn btn-sm ${authMethod === 'email' ? 'btn-primary' : 'btn-tertiary'}`}
              style={{ flex: 1, fontSize: 13 }}
              onClick={() => setAuthMethod('email')}
            >
              ✉️ Email &amp; Password
            </button>
          </div>

          {/* SIGN IN TAB */}
          <TabPanel id="signin" value={tab}>
            <form onSubmit={handleQuickSubmit}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{copy.siTitle}</h2>
              <p className="subtle small" style={{ marginBottom: 18 }}>
                {copy.siSub}
              </p>

              {authMethod === 'phone' ? (
                <Field label="Phone number" htmlFor="ph">
                  <InputRow>
                    <Input
                      value={signinDial}
                      onChange={(e) => setSigninDial(e.target.value)}
                      style={{ maxWidth: 80 }}
                      aria-label="Country code"
                    />
                    <Input
                      id="ph"
                      placeholder="1712 345 678"
                      inputMode="tel"
                      value={signinPhone}
                      onChange={(e) => setSigninPhone(e.target.value)}
                    />
                  </InputRow>
                </Field>
              ) : (
                <>
                  <Field label="Email Address" htmlFor="em">
                    <Input
                      id="em"
                      type="email"
                      placeholder={role === 'admin' ? 'admin@turfchai.com' : 'user@example.com'}
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
                </>
              )}

              <Button variant="primary" block type="submit" style={{ marginTop: 8 }}>
                {authMethod === 'phone' ? 'Send Verification Code 📱' : `Sign In as ${activeRoleConfig?.label} →`}
              </Button>
            </form>

            <div className="row" style={{ margin: '18px 0', alignItems: 'center' }}>
              <hr style={{ flex: 1, margin: 0, opacity: 0.2 }} />
              <span className="subtle tiny" style={{ padding: '0 8px' }}>
                OR
              </span>
              <hr style={{ flex: 1, margin: 0, opacity: 0.2 }} />
            </div>

            <Button
              variant="secondary"
              block
              onClick={() => {
                showToast(`Signed in with Google as ${activeRoleConfig?.label} ✓`);
                navigate(getDestination());
              }}
            >
              {GOOGLE_ICON}
              Continue with Google
            </Button>

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
            <form onSubmit={handleQuickSubmit}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>{copy.suTitle}</h2>
              <p className="subtle small" style={{ marginBottom: 18 }}>
                {copy.suSub}
              </p>

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

              {authMethod === 'phone' ? (
                <Field label="Phone Number" htmlFor="ph2" hint="We will verify this with a 4-digit code.">
                  <InputRow>
                    <Input
                      value={signupDial}
                      onChange={(e) => setSignupDial(e.target.value)}
                      style={{ maxWidth: 80 }}
                      aria-label="Country code"
                    />
                    <Input
                      id="ph2"
                      placeholder="1712 345 678"
                      inputMode="tel"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                    />
                  </InputRow>
                </Field>
              ) : (
                <>
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
                </>
              )}

              <Button variant="primary" block type="submit" style={{ marginTop: 8 }}>
                {authMethod === 'phone' ? 'Verify & Continue →' : `Register as ${activeRoleConfig?.label} →`}
              </Button>
            </form>

            <div className="row" style={{ margin: '18px 0', alignItems: 'center' }}>
              <hr style={{ flex: 1, margin: 0, opacity: 0.2 }} />
              <span className="subtle tiny" style={{ padding: '0 8px' }}>
                OR
              </span>
              <hr style={{ flex: 1, margin: 0, opacity: 0.2 }} />
            </div>

            <Button
              variant="secondary"
              block
              onClick={() => {
                showToast(`Registered with Google as ${activeRoleConfig?.label} ✓`);
                navigate(getDestination());
              }}
            >
              {GOOGLE_ICON}
              Register with Google
            </Button>

            <p className="subtle center tiny" style={{ marginTop: 16, marginBottom: 0 }}>
              By registering, you agree to TurfChai's terms of service and privacy policy.
            </p>
          </TabPanel>
        </Card>

        {/* Role Perks Highlights */}
        <div style={{ marginTop: 24, padding: 16, borderRadius: 16, background: 'var(--surface-2, rgba(255, 255, 255, 0.04))' }}>
          <b style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Features for {activeRoleConfig?.label}:</b>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} className="subtle">
            {copy.perks.map((perk, idx) => (
              <li key={idx} style={{ marginBottom: 4 }}>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* OTP MODAL */}
      <Overlay isOpen={otpModal.isOpen} onClose={otpModal.close} title="Enter Verification Code" hideHeader className="center">
        <h3>Enter 4-Digit Code</h3>
        <p className="subtle small">
          Sent by SMS to {signinDial || signupDial} 1712 ••• 678
        </p>

        <div style={{ margin: '20px 0' }}>
          <OtpInput value={code} onChange={setCode} />
        </div>

        <Button variant="primary" block onClick={handleOtpVerify}>
          Verify Code &amp; Log In
        </Button>

        <p className="subtle tiny" style={{ marginTop: 14 }}>
          Didn't get it?{' '}
          <a
            href="#resend"
            onClick={(e) => {
              e.preventDefault();
              showToast('New verification code sent 📱');
            }}
          >
            Resend Code
          </a>{' '}
          · <span className="num font-semibold">0:45</span>
        </p>

        <Button variant="tertiary" block onClick={otpModal.close} style={{ marginTop: 8 }}>
          Cancel
        </Button>
      </Overlay>
    </>
  );
}
