const API = process.env.E2E_API_URL ?? 'http://localhost:8080';
const WEB = process.env.E2E_WEB_URL ?? 'http://localhost:4173';

/** Credentials the backend seeders create. See src/main/java/.../*DataSeeder.java */
export const ACCOUNTS = {
  playerA: { email: 'rafi@turfchai.dev', password: 'demo1234' },
  demoPassword: 'Demo@12345',
};

async function json(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, ok: res.ok, data: parsed };
}

export const api = {
  get: (path, token) => json(path, { token }),
  post: (path, body, token) => json(path, { method: 'POST', body, token }),
  patch: (path, body, token) => json(path, { method: 'PATCH', body, token }),
  del: (path, token) => json(path, { method: 'DELETE', token }),
};

/** Unwraps the ApiResponse envelope used by the payment/reward controllers. */
export const unwrap = (payload) => (payload && payload.data !== undefined ? payload.data : payload);

export async function login(email, password) {
  const res = await api.post('/auth/login', { email, password });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return { token: res.data.token, user: res.data.user };
}

/** Admin sign-in is two-step; the dev build echoes the code back. */
export async function adminLogin(email, password) {
  const challenge = await api.post('/admin/auth/login', { email, password });
  if (!challenge.ok || !challenge.data.devCode) {
    throw new Error(`admin challenge failed for ${email}: ${challenge.status}`);
  }
  const verified = await api.post('/admin/auth/login/verify', {
    challenge: challenge.data.challenge,
    code: challenge.data.devCode,
  });
  if (!verified.ok) throw new Error(`admin verify failed for ${email}: ${verified.status}`);
  return { token: verified.data.token, user: verified.data.user };
}

/**
 * Finds a seeded demo account with the given role.
 *
 * The demo seeder builds deterministic emails from fixed name pools, so probing
 * that sequence is reliable and needs no database access.
 */
const FIRST = ['Fahim', 'Nadia', 'Tariq', 'Meem', 'Rahim', 'Sadia', 'Arman', 'Tania', 'Imran', 'Riya',
  'Karim', 'Fatema', 'Jakir', 'Layla', 'Rasel', 'Sumaiya', 'Shamim', 'Nusrat', 'Naim', 'Mitu',
  'Riyad', 'Sabina', 'Farhan', 'Ayesha', 'Sagor', 'Jannatul', 'Mizan', 'Tasnim', 'Rubel', 'Noor',
  'Abdur', 'Rifat', 'Masum', 'Shirin', 'Pavel', 'Brishty', 'Shakil', 'Parveen', 'Shohag', 'Meher',
  'Habib', 'Sunita', 'Zahid', 'Liza', 'Tomal', 'Ruma', 'Babu', 'Tamanna', 'Robin', 'Moni'];
const LAST = ['Rahman', 'Hossain', 'Islam', 'Amin', 'Chowdhury', 'Ahmed', 'Khan', 'Sultana',
  'Begum', 'Malik', 'Sarkar', 'Molla', 'Hasan', 'Uddin', 'Mia', 'Bhuiyan', 'Dey', 'Roy', 'Paul', 'Biswas'];

export const seededEmail = (index) =>
  `${FIRST[index % FIRST.length].toLowerCase()}.${LAST[Math.floor(index / FIRST.length) % LAST.length].toLowerCase()}.${index}@gmail.com`;

export async function findSeededAccounts(roles, { limit = 260 } = {}) {
  const wanted = new Map(roles.map((r) => [r.role, r.count]));
  const found = {};
  for (let i = 0; i < limit; i++) {
    if ([...wanted.entries()].every(([role, n]) => (found[role]?.length ?? 0) >= n)) break;
    let session;
    try {
      session = await login(seededEmail(i), ACCOUNTS.demoPassword);
    } catch {
      continue;
    }
    const role = session.user.role;
    if (!wanted.has(role)) continue;
    found[role] = found[role] ?? [];
    if (found[role].length < wanted.get(role)) {
      found[role].push({ ...session, email: seededEmail(i) });
    }
  }
  return found;
}

export { API, WEB };
