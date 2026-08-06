import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/buttons/Button';
import { LiquidCard } from '@/components/cards/Card';
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

export default function AdminLoginPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [challenge, setChallenge] = useState('');
  const [sentTo, setSentTo] = useState('');
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
      setRemaining(response.ttlSeconds);
      setDevCode(response.devCode ?? null);
      setCode('');
      showToast('A new verification code was sent ✉️');
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
      showToast(`Welcome back, ${response.user?.fullName ?? 'Admin'} ✓`);
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
        }}
      >
        <div className="center" style={{ marginBottom: 24 }}>
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
          <p className="subtle small">Restricted access · Authorized personnel only</p>
        </div>

        <LiquidCard style={{ padding: 28, borderRadius: 24 }}>
          {/* Alert message */}
          <div
            className="alert danger"
            style={{ marginBottom: 18, borderRadius: 12, background: 'rgba(201,59,59,0.12)' }}
          >
            <span className="ico">⚠️</span>
            <div>
              <b style={{ display: 'block', marginBottom: 2 }}>Authentication Required</b>
              <span className="small">
                Enter your admin credentials to access the management console.
              </span>
            </div>
          </div>

          {step === 'credentials' && (
            <form onSubmit={handleCredentials}>
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

              <div className="field" style={{ marginBottom: 18 }}>
                <label htmlFor="pw">Password</label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                />
              </div>

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
                    showToast('Password reset link sent to work email ✉️');
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
              <div
                className="alert"
                style={{ marginBottom: 16, borderRadius: 12, background: 'rgba(76,161,120,0.12)' }}
              >
                <span className="ico">🔐</span>
                <div>
                  <b style={{ display: 'block', marginBottom: 2 }}>Two-Factor Verification</b>
                  <span className="small">
                    A 6-digit code was sent to <b>{sentTo}</b>
                  </span>
                </div>
              </div>

              {devCode && (
                <div
                  className="alert"
                  style={{ marginBottom: 16, borderRadius: 12, background: 'rgba(120,144,201,0.14)' }}
                >
                  <span className="ico">🧪</span>
                  <div>
                    <b style={{ display: 'block', marginBottom: 2 }}>Demo mode</b>
                    <span className="small">
                      No SMTP configured — your verification code is{' '}
                      <b style={{ letterSpacing: 1.5 }}>{devCode}</b>
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
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
                  required
                  autoFocus
                />
              </Field>

              <div className="between" style={{ marginBottom: 20 }}>
                <button
                  type="button"
                  className="small subtle linklike"
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
                  className="small subtle linklike"
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

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <p className="tiny subtle" style={{ margin: 0 }}>
              🔒 Protected by 2FA &amp; Audit Logging
            </p>
          </div>
        </LiquidCard>
      </div>
    </>
  );
}