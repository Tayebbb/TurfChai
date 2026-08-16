import { useEffect, useRef, useState } from 'react';
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

const OTP_LENGTH = 6;

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
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [remaining, setRemaining] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const otpRefs = useRef([]);

  // The prototype painted this glow on <body>; scope it to the route instead.
  useBodyClass('admin-login-bg');

  useEffect(() => {
    if (step !== 'otp') return;
    const timer = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step === 'otp') otpRefs.current[0]?.focus();
  }, [step]);

  const handleCredentials = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await adminLogin({ email: email.trim(), password });
      setChallenge(response.challenge);
      setRemaining(response.ttlSeconds);
      setCode('');
      setDevCode(response.devCode || '');
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
      setRemaining(response.ttlSeconds);
      setCode('');
      setDevCode(response.devCode || '');
      otpRefs.current[0]?.focus();
      showToast('A new verification code was sent');
    } catch (error) {
      showToast(error?.message || 'Could not resend the code', { duration: 5000 });
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!challenge || code.length !== OTP_LENGTH) {
      showToast(`Enter the ${OTP_LENGTH}-digit verification code`, { duration: 4000 });
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

  const handleOtpChange = (index, raw) => {
    const digit = raw.replace(/\D/g, '').slice(0, 1);
    const next = code.slice(0, index) + digit + code.slice(index + 1);
    setCode(next.slice(0, OTP_LENGTH));
    if (digit && index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!digits) return;
    setCode(digits);
    otpRefs.current[Math.min(digits.length, OTP_LENGTH) - 1]?.focus();
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <>
      <PageTitle title="Admin Sign In" />

      <div className="tc-admin-login">
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
          <div className="center" style={{ marginBottom: 26, textAlign: 'center' }}>
            <Link
              className="brand tc-login-brand"
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
            <p className="subtle small" style={{ margin: 0, color: 'var(--text-3)' }}>
              Restricted access · Authorized personnel only
            </p>
          </div>

          <Card className="tc-login-card" style={{ padding: 28, borderRadius: 24 }}>
            {/* Step indicator */}
            <div
              role="tablist"
              aria-label="Sign in steps"
              className="seg tc-login-steps"
              style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, marginBottom: 24 }}
            >
              {STEPS.map((item, index) => (
                <div
                  key={item.id}
                  role="tab"
                  aria-selected={step === item.id}
                  aria-disabled={index > stepIndex}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 12.5,
                    textAlign: 'center',
                    transition: 'all 240ms var(--ease)',
                    background: step === item.id ? 'var(--brand)' : 'transparent',
                    color: step === item.id ? '#fff' : 'var(--text-2)',
                    opacity: index > stepIndex ? 0.4 : 1,
                  }}
                >
                  {index + 1}. {item.label}
                </div>
              ))}
            </div>

            {/* Step content (key remounts the panel so its entrance animation replays) */}
            {step === 'credentials' && (
              <form className="tc-login-step" key="credentials" onSubmit={handleCredentials}>
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
                      className="tc-login-eye"
                    >
                      <EyeIcon off={showPassword} />
                    </button>
                  </div>
                </Field>

                <div className="between" style={{ marginBottom: 22 }}>
                  <label className="checkline" style={{ margin: 0, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    <span className="small">Remember device (30 days)</span>
                  </label>
                  <span className="small subtle" title="Self-service password reset isn't available yet — ask a super admin to reset your credentials.">
                    Forgot password?
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  block
                  type="submit"
                  style={{ fontWeight: 700 }}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Checking…' : 'Continue →'}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form className="tc-login-step" key="otp" onSubmit={handleVerify}>
                <div className="tc-otp-head">
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Enter verification code</h2>
                  <p className="small" style={{ margin: '4px 0 0', color: 'var(--text-3)' }}>
                    Check your email for the 6-digit code
                  </p>
                </div>

                {devCode && (
                  <div
                    style={{
                      margin: '12px 0',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px dashed rgba(34, 197, 94, 0.4)',
                      textAlign: 'center',
                    }}
                  >
                    <span className="tiny subtle" style={{ display: 'block' }}>
                      Development code (also emailed to the admin)
                    </span>
                    <b className="num" style={{ fontSize: 22, letterSpacing: 6, color: 'var(--green)' }}>
                      {devCode}
                    </b>
                  </div>
                )}

                <div className="tc-otp-cells" role="group" aria-label="Verification code" onPaste={handleOtpPaste}>
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-label={`Digit ${index + 1}`}
                      value={code[index] ?? ''}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      maxLength={1}
                    />
                  ))}
                </div>

                <div className="between" style={{ margin: '2px 0 22px' }}>
                  <button
                    type="button"
                    className="small subtle tc-login-link"
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
                    className="small subtle tc-login-link"
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
                  loading={isVerifying}
                  disabled={isVerifying}
                >
                  {isVerifying ? 'Verifying…' : 'Verify & Sign In →'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>

      <style>{`
        .tc-admin-login .tc-login-card {
          animation: tc-login-pop 520ms var(--ease-out) both;
        }
        .tc-login-step {
          animation: tc-login-step-in 340ms var(--ease-out) both;
        }
        .tc-admin-login .tc-login-steps > div[role="tab"] {
          box-shadow: 0 1px 2px rgba(0,0,0,0.04);
        }
        .tc-admin-login .tc-login-eye {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 10px;
          background: transparent;
          color: var(--text-3);
          cursor: pointer;
          transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
        }
        .tc-admin-login .tc-login-eye:hover {
          color: var(--text);
          background: var(--surface-2);
        }
        .tc-admin-login .tc-otp-cells {
          display: flex;
          gap: 8px;
          justify-content: center;
          margin: 18px 0 20px;
        }
        .tc-admin-login .tc-otp-cells input {
          width: 46px;
          height: 54px;
          text-align: center;
          font-size: 22px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--text);
          background: var(--surface);
          border: 1.5px solid var(--border-strong);
          border-radius: 14px;
          outline: none;
          transition: border-color var(--dur) var(--ease),
                      box-shadow var(--dur) var(--ease),
                      transform var(--dur) var(--ease);
        }
        .tc-admin-login .tc-otp-cells input:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px var(--brand-soft);
          transform: translateY(-2px);
        }
        .tc-admin-login .tc-login-link {
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 600;
          transition: color var(--dur) var(--ease);
        }
        .tc-admin-login .tc-login-link:hover:not(:disabled) {
          color: var(--text);
        }
        .tc-admin-login .tc-login-link:disabled {
          cursor: default;
        }
        @keyframes tc-login-pop {
          from { opacity: 0; transform: translateY(14px) scale(0.985); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes tc-login-step-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tc-admin-login .tc-login-card,
          .tc-login-step,
          .tc-admin-login .tc-otp-cells input {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}
