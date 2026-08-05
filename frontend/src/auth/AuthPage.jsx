import {
  useState,
} from 'react';

import {
  Button,
} from '@/components/buttons/Button';

import {
  Card,
} from '@/components/cards/Card';

import {
  PageTitle,
} from '@/components/common/PageTitle';

import {
  Field,
  Input,
  InputRow,
} from '@/components/forms/Field';

import {
  OtpInput,
} from '@/components/forms/OtpInput';

import {
  Overlay,
} from '@/components/modals/Overlay';

import {
  Tabs,
  TabPanel,
} from '@/components/navigation/Tabs';

import {
  useDisclosure,
} from '@/hooks/useDisclosure';

import {
  useToast,
} from '@/hooks/useToast';

import {
  paths,
} from '@/routes/paths';




const ROLES = [
  {
    id: 'player',
    label: "⚽ I'm a player",
  },
  {
    id: 'owner',
    label: '🏟️ I run a turf',
  },
];




const AUTH_TABS = [
  {
    id: 'signin',
    label: 'Sign in',
  },
  {
    id: 'signup',
    label: 'Create account',
  },
];




const ROLE_COPY = {
  player: {
    siTitle: 'Welcome back',
    siSub: "Sign in with your phone number — we'll text you a code.",
    suTitle: 'Join TurfChai',
    suSub: 'One account for booking, open games, and rewards.',
  },
  owner: {
    siTitle: 'Welcome back, owner',
    siSub: 'Sign in to your turf dashboard — calendar, payments, and the QR gate.',
    suTitle: 'List your turf',
    suSub: "Create an owner account — we'll walk you through venue setup and verification.",
  },
};




const GOOGLE_ICON = (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      fill="#4285F4"
      d="M23.5 12.3c0-.9-.1-1.7-.2-2.5H12v4.7h6.5c-.3 1.5-1.1 2.8-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
    />

    <path
      fill="#34A853"
      d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1C3.2 21.3 7.3 24 12 24z"
    />

    <path
      fill="#FBBC05"
      d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.2C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4.1-3.1z"
    />

    <path
      fill="#EA4335"
      d="M12 4.7c1.8 0 3.3.6 4.6 1.8L20 3C18 1.1 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4.1 3.1c.9-2.9 3.6-5 6.7-5z"
    />
  </svg>
);




export default function AuthPage() {
  const {
    showToast,
  } = useToast();

  const otpModal = useDisclosure();

  const [role, setRole] = useState('player');
  const [tab, setTab] = useState('signin');
  const [code, setCode] = useState('481');

  const [signinDial, setSigninDial] = useState('+880');
  const [signinPhone, setSigninPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [signupDial, setSignupDial] = useState('+880');
  const [signupPhone, setSignupPhone] = useState('');

  const copy = ROLE_COPY[role];

  /** Owners land in their console; players continue to profile onboarding. */
  const verifyTo =
    role === 'owner'
      ? tab === 'signup'
        ? paths.owner.onboarding
        : paths.owner.dashboard
      : paths.player.onboarding;

  return (
    <>
      <PageTitle
        title="Sign in"
      />

      <div
        className="wrap-form"
        style={{
          paddingTop: 48,
          paddingBottom: 64,
        }}
      >
        <div
          className="seg glass"
          role="tablist"
          aria-label="Account type"
          style={{
            display: 'flex',
            marginBottom: 14,
          }}
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
              }}
              onClick={() => setRole(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <Card
          style={{
            padding: 24,
          }}
        >
          <div
            style={{
              marginBottom: 18,
            }}
          >
            <Tabs
              items={AUTH_TABS}
              value={tab}
              onChange={setTab}
              label="Authentication"
            />
          </div>

          {/* SIGN IN */}
          <TabPanel id="signin" value={tab}>
            <h2
              style={{
                fontSize: 20,
              }}
            >
              {copy.siTitle}
            </h2>

            <p
              className="subtle"
              style={{
                marginBottom: 16,
              }}
            >
              {copy.siSub}
            </p>

            <Field
              label="Phone number"
              htmlFor="ph"
            >
              <InputRow>
                <Input
                  value={signinDial}
                  onChange={(event) => setSigninDial(event.target.value)}
                  style={{
                    maxWidth: 84,
                  }}
                  aria-label="Country code"
                />

                <Input
                  id="ph"
                  placeholder="1712 345 678"
                  inputMode="tel"
                  value={signinPhone}
                  onChange={(event) => setSigninPhone(event.target.value)}
                />
              </InputRow>
            </Field>

            <Button
              variant="primary"
              block
              onClick={otpModal.open}
            >
              Send code
            </Button>

            <div
              className="row"
              style={{
                margin: '16px 0',
              }}
            >
              <hr
                style={{
                  flex: 1,
                  margin: 0,
                }}
              />

              <span
                className="subtle"
              >
                or
              </span>

              <hr
                style={{
                  flex: 1,
                  margin: 0,
                }}
              />
            </div>

            <Button
              variant="secondary"
              block
              onClick={() => showToast('Signed in with Google ✓')}
            >
              {GOOGLE_ICON}

              Continue with Google
            </Button>

            <p
              className="subtle center"
              style={{
                marginTop: 14,
              }}
            >
              <a
                href="#trouble"
                onClick={(event) => {
                  event.preventDefault();
                  showToast('Recovery link sent to your phone 📱');
                }}
              >
                Trouble signing in?
              </a>
            </p>
          </TabPanel>

          {/* SIGN UP */}
          <TabPanel id="signup" value={tab}>
            <h2
              style={{
                fontSize: 20,
              }}
            >
              {copy.suTitle}
            </h2>

            <p
              className="subtle"
              style={{
                marginBottom: 16,
              }}
            >
              {copy.suSub}
            </p>

            <Field
              label="Full name"
              htmlFor="nm"
            >
              <Input
                id="nm"
                placeholder="Rafiul Karim"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </Field>

            <Field
              label="Phone number"
              htmlFor="ph2"
              hint="We'll verify this with a one-time code."
            >
              <InputRow>
                <Input
                  value={signupDial}
                  onChange={(event) => setSignupDial(event.target.value)}
                  style={{
                    maxWidth: 84,
                  }}
                  aria-label="Country code"
                />

                <Input
                  id="ph2"
                  placeholder="1712 345 678"
                  inputMode="tel"
                  value={signupPhone}
                  onChange={(event) => setSignupPhone(event.target.value)}
                />
              </InputRow>
            </Field>

            <Button
              variant="primary"
              block
              onClick={otpModal.open}
            >
              Verify &amp; continue
            </Button>

            <div
              className="row"
              style={{
                margin: '16px 0',
              }}
            >
              <hr
                style={{
                  flex: 1,
                  margin: 0,
                }}
              />

              <span
                className="subtle"
              >
                or
              </span>

              <hr
                style={{
                  flex: 1,
                  margin: 0,
                }}
              />
            </div>

            <Button
              variant="secondary"
              block
              onClick={() => showToast('Account created with Google ✓')}
            >
              Continue with Google
            </Button>

            <p
              className="subtle center"
              style={{
                marginTop: 14,
              }}
            >
              By continuing you agree to TurfChai's terms and cancellation policies.
            </p>
          </TabPanel>
        </Card>
      </div>

      {/* OTP MODAL */}
      <Overlay
        isOpen={otpModal.isOpen}
        onClose={otpModal.close}
        title="Enter the 4-digit code"
        hideHeader
        className="center"
      >
        <h3>
          Enter the 4-digit code
        </h3>

        <p
          className="subtle"
        >
          Sent by SMS to +880 1712 ••• 678
        </p>

        <div
          style={{
            margin: '18px 0',
          }}
        >
          <OtpInput
            value={code}
            onChange={setCode}
          />
        </div>

        <Button
          variant="primary"
          block
          to={verifyTo}
        >
          Verify
        </Button>

        <p
          className="subtle"
          style={{
            marginTop: 12,
          }}
        >
          Didn't get it?{' '}

          <a
            href="#resend"
            onClick={(event) => {
              event.preventDefault();
              showToast('New code sent 📱');
            }}
          >
            Resend code
          </a>{' '}

          · <span
              className="num"
            >
              0:42
            </span>
        </p>

        <Button
          variant="tertiary"
          onClick={otpModal.close}
        >
          Cancel
        </Button>
      </Overlay>
    </>
  );
}
