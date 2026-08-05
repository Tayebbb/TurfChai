import {
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  Button,
} from '@/components/buttons/Button';

import {
  LiquidCard,
} from '@/components/cards/Card';

import {
  PageTitle,
} from '@/components/common/PageTitle';

import {
  Field,
  Input,
} from '@/components/forms/Field';

import {
  useBodyClass,
} from '@/hooks/useBodyClass';

import {
  useToast,
} from '@/hooks/useToast';

import {
  paths,
} from '@/routes/paths';

import { login } from '@/api/auth';
import { setSession } from '@/api/client';

export default function AdminLoginPage() {
  const {
    showToast,
  } = useToast();

  const navigate = useNavigate();

  const [email, setEmail] = useState('nadia@turfchai.com');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The prototype painted this glow on <body>; scope it to the route instead.
  useBodyClass('admin-login-bg');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await login({ email: email.trim(), password });
      setSession(response);
      showToast(`Welcome back, ${response.user?.fullName ?? 'Admin'} ✓`);
      navigate(paths.admin.dashboard);
    } catch (error) {
      showToast(error?.message || 'Invalid email or password', { duration: 5000 });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageTitle
        title="Admin Sign In"
      />

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
        <div
          className="center"
          style={{
            marginBottom: 24,
          }}
        >
          <Link
            className="brand"
            to={paths.landing}
            style={{
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            <svg
              viewBox="0 0 32 32"
              width="36"
              height="36"
              aria-hidden="true"
            >
              <path
                d="M16 2.5C9.6 2.5 4.5 7.6 4.5 14c0 8.2 11.5 15.5 11.5 15.5S27.5 22.2 27.5 14C27.5 7.6 22.4 2.5 16 2.5z"
                fill="var(--brand)"
              />

              <rect
                x="10"
                y="8.5"
                width="12"
                height="11"
                rx="2"
                fill="none"
                stroke="#fff"
                strokeWidth="1.5"
              />

              <line
                x1="16"
                y1="8.5"
                x2="16"
                y2="19.5"
                stroke="#fff"
                strokeWidth="1.5"
              />

              <circle
                cx="16"
                cy="14"
                r="2.2"
                fill="none"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </svg>

            TurfChai
          </Link>

          <h1
            style={{
              fontSize: 24,
              marginTop: 12,
              marginBottom: 4,
              fontWeight: 800,
            }}
          >
            Admin Portal
          </h1>

          <p
            className="subtle small"
          >
            Restricted access · Authorized personnel only
          </p>
        </div>

        <LiquidCard
          style={{
            padding: 28,
            borderRadius: 24,
          }}
        >
          {/* Alert message */}
          <div
            className="alert danger"
            style={{
              marginBottom: 18,
              borderRadius: 12,
              background: 'rgba(201,59,59,0.12)',
            }}
          >
            <span className="ico">⚠️</span>

            <div>
              <b
                style={{
                  display: 'block',
                  marginBottom: 2,
                }}
              >
                Authentication Required
              </b>

              <span
                className="small"
              >
                Enter your admin credentials to access the management console.
              </span>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
          >
            <Field
              label="Work Email"
              htmlFor="em"
            >
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

            <div
              className="field"
              style={{
                marginBottom: 18,
              }}
            >
              <label
                htmlFor="pw"
              >
                Password
              </label>

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

            <div
              className="between"
              style={{
                marginBottom: 20,
              }}
            >
              <label
                className="checkline"
                style={{
                  margin: 0,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />

                <span
                  className="small"
                >
                  Remember device (30 days)
                </span>
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
              style={{
                fontWeight: 700,
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing In…' : 'Sign In to Dashboard →'}
            </Button>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <p
              className="tiny subtle"
              style={{
                margin: 0,
              }}
            >
              🔒 Protected by 2FA &amp; Audit Logging
            </p>
          </div>
        </LiquidCard>
      </div>
    </>
  );
}
