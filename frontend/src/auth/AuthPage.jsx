import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Card } from '@/components/cards/Card';
import { PageTitle } from '@/components/common/PageTitle';
import { Field, Input } from '@/components/forms/Field';
import { OtpInput } from '@/components/forms/OtpInput';
import { Tabs, TabPanel } from '@/components/navigation/Tabs';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { login, register, checkEmail, requestOtp, verifyOtp } from '@/api/auth';
import { setSession } from '@/api/client';
import { toUserMessage } from '@/utils/errorMessage';

const EyeIcon = ({ off = false }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

const ROLE_TO_API = { player: 'PLAYER', owner: 'OWNER' };

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
];

const AUTH_TABS = [
  { id: 'signin', label: 'Sign in' },
  { id: 'phone', label: 'Phone code' },
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
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Server-side field errors, rendered beside the field they belong to. A
  // fading toast reading "password: ..." left the user with nothing to act on.
  const [fieldErrors, setFieldErrors] = useState({});

  // Phone sign-in. Doubles as account recovery: there is no password to reset,
  // so a code to the registered number is how you get back in.
  const [otpPhone, setOtpPhone] = useState('');
  const [otpStep, setOtpStep] = useState('phone'); // 'phone' | 'code'
  const [otpCode, setOtpCode] = useState('');
  const [otpName, setOtpName] = useState('');
  const [otpDevCode, setOtpDevCode] = useState(null);
  const [otpError, setOtpError] = useState(null);

  const activeRoleConfig = ROLES.find((r) => r.id === role);

  /** Map the DB role (returned by the login API) to a redirect destination */
  const getDestinationByRole = (apiRole) => {
    if (nextPath && nextPath.startsWith('/')) return nextPath;
    if (apiRole === 'ADMIN' || apiRole === 'SUPER_ADMIN') return paths.admin.dashboard;
    if (apiRole === 'OWNER') return paths.owner.dashboard;
    return paths.player.home;
  };

  const handleApiError = (error) => {
    const details = error?.validationErrors ?? error?.detail?.validationErrors;
    if (details && typeof details === 'object') {
      setFieldErrors(details);
      showToast('Please correct the highlighted fields.', { duration: 5000 });
    } else {
      showToast(error?.message || 'Something went wrong. Please try again.', { duration: 5000 });
    }
    setIsSubmitting(false);
  };

  const handleRequestOtp = async (event) => {
    event?.preventDefault();
    const phone = otpPhone.trim();
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(phone)) {
      setOtpError('Enter a valid phone number');
      return;
    }
    setOtpError(null);
    setIsSubmitting(true);
    try {
      const response = await requestOtp(phone);
      // Only present when the server is configured to expose it; in a real
      // deployment the code arrives by SMS and this stays null.
      setOtpDevCode(response?.devCode ?? null);
      setOtpCode('');
      setOtpStep('code');
      showToast(response?.message || 'Verification code sent');
    } catch (error) {
      setOtpError(toUserMessage(error, 'Could not send a code to that number.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event?.preventDefault();
    if (otpCode.trim().length < 4) {
      setOtpError('Enter the 4-digit code');
      return;
    }
    setOtpError(null);
    setIsSubmitting(true);
    try {
      const response = await verifyOtp({
        phone: otpPhone.trim(),
        code: otpCode.trim(),
        fullName: otpName.trim() || undefined,
      });
      setSession(response);
      showToast('Signed in successfully ✓');
      navigate(getDestinationByRole(response?.user?.role ?? 'PLAYER'));
    } catch (error) {
      setOtpError(toUserMessage(error, 'That code was not accepted.'));
    } finally {
      setIsSubmitting(false);
    }
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

    if (role === 'owner') {
      try {
        const emailCheck = await checkEmail(signupEmail);
        if (emailCheck?.exists) {
          showToast('An account with this email already exists. Please sign in instead.');
          setIsSubmitting(false);
          return;
        }
        navigate(paths.owner.onboarding, {
          state: { fullName, signupEmail, signupPassword }
        });
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

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
      else navigate(paths.player.onboarding);
    } catch (error) {
      handleApiError(error);
    }
  };

  const eyeButtonStyle = {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: 8,
    transition: 'color 0.2s ease',
  };

  return (
    <>
      <PageTitle title="Authentication — TurfChai" />

      <div className="wrap-form" style={{ paddingTop: 36, paddingBottom: 64 }}>
        <h1 className="sr-only">Sign in or create your TurfChai account</h1>
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
                <div style={{ position: 'relative', width: '100%' }}>
                  <Input
                    id="pw"
                    type={showSigninPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    style={eyeButtonStyle}
                    onClick={() => setShowSigninPassword((prev) => !prev)}
                    aria-label={showSigninPassword ? 'Hide password' : 'Show password'}
                    title={showSigninPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon off={showSigninPassword} />
                  </button>
                </div>
              </Field>

              <Button variant="primary" block type="submit" style={{ marginTop: 8 }} disabled={isSubmitting}>
                {isSubmitting ? 'Working…' : 'Sign In →'}
              </Button>
            </form>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--border-soft)' }}>
              <span className="tiny subtle" style={{ display: 'block', marginBottom: 8, fontWeight: 700 }}>
                DEMO SIGN-IN ACCOUNTS (Password: TurfChai@123)
              </span>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => {
                    setSigninEmail('rafi@turfchai.com');
                    setSigninPassword('TurfChai@123');
                  }}
                >
                  ⚽ Player (Rafi)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => {
                    setSigninEmail('mahmud@turfchai.com');
                    setSigninPassword('TurfChai@123');
                  }}
                >
                  🏟️ Owner (Mahmud)
                </button>
              </div>
            </div>

            <p className="subtle center tiny" style={{ marginTop: 16, marginBottom: 0 }}>
              Forgot your password?{' '}
              <button
                type="button"
                className="btn btn-tertiary btn-sm"
                onClick={() => {
                  setOtpError(null);
                  setTab('phone');
                }}
              >
                Sign in with a phone code
              </button>
            </p>
          </TabPanel>

          {/* PHONE CODE TAB — also the account-recovery path */}
          <TabPanel id="phone" value={tab}>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Sign in with your phone</h2>
            <p className="subtle small" style={{ marginBottom: 18 }}>
              We send a short code to your number. Use this if you have forgotten your password —
              TurfChai has no password-reset email.
            </p>

            {otpStep === 'phone' ? (
              <form onSubmit={handleRequestOtp}>
                <Field label="Phone number" htmlFor="otpPhone">
                  <Input
                    id="otpPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+8801XXXXXXXXX"
                    value={otpPhone}
                    onChange={(event) => setOtpPhone(event.target.value)}
                  />
                </Field>

                {otpError ? (
                  <div className="alert warn" role="status" style={{ marginTop: 8 }}>
                    <span className="ico">⚠️</span>
                    <div>{otpError}</div>
                  </div>
                ) : null}

                <Button variant="primary" block type="submit" style={{ marginTop: 8 }} disabled={isSubmitting}>
                  {isSubmitting ? 'Sending…' : 'Send code'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <p className="subtle small">
                  Enter the code sent to <b>{otpPhone}</b>.
                </p>

                {otpDevCode ? (
                  <div className="alert info" style={{ marginBottom: 10 }}>
                    <span className="ico" aria-hidden="true">🔑</span>
                    <div className="small">
                      Development code: <b className="num">{otpDevCode}</b>
                    </div>
                  </div>
                ) : null}

                <Field label="Verification code" htmlFor="otpCode">
                  <OtpInput length={4} value={otpCode} onChange={setOtpCode} label="Verification code" />
                </Field>

                <Field
                  label="Your name"
                  htmlFor="otpName"
                  hint="Only needed if this number does not have an account yet."
                >
                  <Input
                    id="otpName"
                    value={otpName}
                    autoComplete="name"
                    onChange={(event) => setOtpName(event.target.value)}
                  />
                </Field>

                {otpError ? (
                  <div className="alert warn" role="status" style={{ marginTop: 8 }}>
                    <span className="ico">⚠️</span>
                    <div>{otpError}</div>
                  </div>
                ) : null}

                <Button variant="primary" block type="submit" style={{ marginTop: 8 }} disabled={isSubmitting}>
                  {isSubmitting ? 'Verifying…' : 'Verify & sign in →'}
                </Button>
                <Button
                  variant="tertiary"
                  block
                  type="button"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setOtpStep('phone');
                    setOtpCode('');
                    setOtpDevCode(null);
                    setOtpError(null);
                  }}
                >
                  Use a different number
                </Button>
              </form>
            )}
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
              <Field label="Full Name" htmlFor="nm" error={fieldErrors.fullName}>
                <Input
                  id="nm"
                  required
                  minLength={2}
                  placeholder="e.g. Mahfuzur Rahman"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </Field>

              <Field label="Email Address" htmlFor="su-em" error={fieldErrors.email}>
                <Input
                  id="su-em"
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />
              </Field>

              <Field label="Create Password" htmlFor="pw2" error={fieldErrors.password}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Input
                    id="pw2"
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    style={{ paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    style={eyeButtonStyle}
                    onClick={() => setShowSignupPassword((prev) => !prev)}
                    aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    title={showSignupPassword ? 'Hide password' : 'Show password'}
                  >
                    <EyeIcon off={showSignupPassword} />
                  </button>
                </div>
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
