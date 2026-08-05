import { api } from '@/api/client';

/** Register a new account and receive a JWT. */
export function register(payload) {
  return api('/auth/register', { method: 'POST', body: payload, token: false });
}

/** Log in with email + password and receive a JWT. */
export function login(payload) {
  return api('/auth/login', { method: 'POST', body: payload, token: false });
}

/** Request an OTP for a phone number. Returns { sent, message, ttlSeconds, devCode }. */
export function requestOtp(phone) {
  return api('/auth/otp/request', { method: 'POST', body: { phone }, token: false });
}

/** Verify an OTP; creates the account when none exists. Returns { token, user }. */
export function verifyOtp(payload) {
  return api('/auth/otp/verify', { method: 'POST', body: payload, token: false });
}

/** Fetch the currently authenticated user. */
export function getMe() {
  return api('/me');
}
