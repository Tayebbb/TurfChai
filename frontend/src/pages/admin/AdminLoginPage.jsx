import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { Card } from '@/components/cards/Card';
import { PageTitle } from '@/components/common/PageTitle';
import { Field, Input } from '@/components/forms/Field';
import { useBodyClass } from '@/hooks/useBodyClass';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { adminLogin, adminVerifyLogin } from '@/api/admin';
import { setSession } from '@/api/client';

const formatSeconds = (total) => {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M21 2l-9.6 9.6" />
    <path d="M15.5 7.5l3 3L22 7l-3-3" />
  </svg>
);

const ChipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
  </svg>
);

const EyeIcon = ({ off = false }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

const STEPS = [
  { id: 'credentials', label: 'Credentials' },
  { id: 'otp', label: 'Verify code' },
];

export default function AdminLoginPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [challenge, setChallenge] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState(300);
  const [devCode, setDevCode] = useState(null);
  const [code, setCode] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // The prototype painted this glow on <body>; scope it to the route instead.
  useBodyClass('admin-login-bg');

  useEffect(() => {
    if (step !== 'otp') return;
    const timer = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const handleCredentials = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await adminLogin({ email: email.trim(), password });
      setChallenge(response.challenge);
      setSentTo(response.sentTo);
      setTtlSeconds(response.ttlSeconds);
      setRemaining(response.ttlSeconds);
      setDevCode(response.devCode ?? null);
      setCode('');
      setStep('otp');
    } catch (error) {
      showToast(error?.message || 'Invalid email or password', { duration: 5000 });
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const response = await adminLogin({ email: email.trim(), password });
      setChallenge(response.challenge);
      setSentTo(response.sentTo);
      setTtlSeconds(response.ttlSeconds);
      setRemaining(response.ttlSeconds);
      setDevCode(response.devCode ?? null);
      setCode('');
      showToast('A new verification code was sent');
    } catch (error) {
      showToast(error?.message || 'Could not resend the code', { duration: 5000 });
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!challenge || /^\d{6}$/.test(code) === false) {
      showToast('Enter the 6-digit verification code', { duration: 4000 });
      return;
    }
    setIsVerifying(true);
    try {
      const response = await adminVerifyLogin({ challenge, code });
      setSession(response);
      showToast(`Welcome back, ${response.user?.fullName ?? 'Admin'}`);
      navigate(paths.admin.dashboard);
    } catch (error) {
      const message = error?.message || 'Invalid verification code';
      showToast(message, { duration: 5000 });
      if (/expired|many failed attempts/i.test(message)) {
        setStep('credentials');
        setChallenge('');
        setCode('');
      }
      setIsVerifying(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <>
      <PageTitle title="Admin Sign In" />

      <div
        className="wrap-form"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: 40,
          paddingBottom: 40,
          maxWidth: 480,
        }}
      >
        {/* Brand + heading (mirrors the shared auth page) */}
        <div className="center" style={{ marginBottom: 24, textAlign: 'center' }}>
          <Link
            className="brand"
            to={paths.landing}
            style={{ justifyContent: 'center', fontSize: 24 }}
          >
            <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true">
              <path
                d="M16 2.5C9.6 2.5 4.5 7.6 4.5 14c0 0 11.5 15.5 11.5 15.5S27.5 22.2 27.5 14C27.5 7.6 22.4 2.5 16 2.5z"
                fill="var(--brand)"
              />
              <rect x="10" y="8.5" width="12" height="11" rx="2" fill="none" stroke="#fff" strokeWidth="1.5" />
              <line x1="16" y1="8.5" x2="16" y2="19.5" stroke="#fff" strokeWidth="1.5" />
              <circle cx="16" cy="14" r="2.2" fill="none" stroke="#fff" strokeWidth="1.5" />
            </svg>
            TurfChai
          </Link>
          <h1 style={{ fontSize: 24, marginTop: 12, marginBottom: 4, fontWeight: 800 }}>
            Admin Portal
          </h1>
          <p className="subtle small" style={{ margin: 0 }}>
            Restricted access · Authorized personnel only
          </p>
        </div>

        <Card style={{ padding: 24, borderRadius: 20 }}>
          {/* Step indicator */}
          <div
            role="tablist"
            aria-label="Sign in steps"
            className="seg"
            style={{ display: 'flex', gap: 6, padding: 6, borderRadius: 14, marginBottom: 20 }}
          >
            {STEPS.map((item, index) => (
              <div
                key={item.id}
                role="tab"
                aria-selected={step === item.id}
                aria-disabled={index > stepIndex}
                className={step === item.id ? 'on' : undefined}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 12.5,
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  opacity: index > stepIndex ? 0.45 : 1,
                }}
              >
                {index + 1}. {item.label}
              </div>
            ))}
          </div>

          {step === 'credentials' && (
            <form onSubmit={handleCredentials}>
              <div className="alert info" style={{ marginBottom: 18 }}>
                <ShieldIcon />
                <div>
                  <b style={{ display: 'block', marginBottom: 2 }}>Authentication Required</b>
                  <span className="small">Enter your admin credentials to access the management console.</span>
                </div>
              </div>

              <Field label="Work Email" htmlFor="em">
                <Input
                  id="em"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@turfchai.com"
                  required
                  autoComplete="username"
                />
              </Field>

              <Field label="Password" htmlFor="pw">
                <div style={{ position: 'relative' }}>
                  <Input
                    id="pw"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 34,
                      height: 34,
                      border: 'none',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--text-3)',
                      cursor: 'pointer',
                      transition: 'color 180ms cubic-bezier(.4, 0, .2, 1)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </Field>

              <div className="between" style={{ marginBottom: 20 }}>
                <label className="checkline" style={{ margin: 0, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <span className="small">Remember device (30 days)</span>
                </label>
                <a
                  className="small subtle"
                  href="#forgot-password"
                  onClick={(event) => {
                    event.preventDefault();
                    showToast('Password reset link sent to work email');
                  }}
                >
                  Forgot password?
                </a>
              </div>

              <Button
                variant="primary"
                size="lg"
                block
                type="submit"
                style={{ fontWeight: 700 }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Checking…' : 'Continue →'}
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerify}>
              <div className="alert ok" style={{ marginBottom: 16 }}>
                <KeyIcon />
                <div>
                  <b style={{ display: 'block', marginBottom: 2 }}>Two-Factor Verification</b>
                  <span className="small">
                    A 6-digit code was sent to <b>{sentTo}</b>
                  </span>
                </div>
              </div>

              {devCode && (
                <div className="alert info" style={{ marginBottom: 16 }} role="status" aria-live="polite">
                  <ChipIcon />
                  <div>
                    <b style={{ display: 'block', marginBottom: 2 }}>Demo mode</b>
                    <span className="small">
                      No SMTP configured — your verification code is{' '}
                      <b style={{ letterSpacing: 1.5, fontVariantNumeric: 'tabular-nums' }}>{devCode}</b>
                    </span>
                  </div>
                </div>
              )}

              <Field label="Verification code" htmlFor="otp">
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                  required
                  autoFocus
                />
              </Field>

              <div className="between" style={{ marginBottom: 20 }}>
                <button
                  type="button"
                  className="small subtle"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => {
                    setStep('credentials');
                    setChallenge('');
                    setCode('');
                  }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="small subtle"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  onClick={handleResend}
                  disabled={isResending || remaining > 0}
                >
                  {isResending
                    ? 'Sending…'
                    : remaining > 0
                      ? `Resend in ${formatSeconds(remaining)}`
                      : 'Resend code'}
                </button>
              </div>

              <Button
                variant="primary"
                size="lg"
                block
                type="submit"
                style={{ fontWeight: 700 }}
                disabled={isVerifying}
              >
                {isVerifying ? 'Verifying…' : 'Verify & Sign In →'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
