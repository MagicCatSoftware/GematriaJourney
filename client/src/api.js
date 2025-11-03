// client/src/api.js

// ---------- Base URL ----------
const BASE =
  (import.meta?.env?.VITE_SERVER_URL && import.meta.env.VITE_SERVER_URL.trim()) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

// ---------- Small utils ----------
const isJSON = (ct) => (ct || '').includes('application/json');
const toQS = (params) => (params ? `?${new URLSearchParams(params).toString()}` : '');
const withTimeout = (ms, signal) => {
  if (!ms) return undefined;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(new DOMException('Timeout', 'TimeoutError')), ms);
  if (signal) signal.addEventListener('abort', () => clearTimeout(t), { once: true });
  return ctrl.signal;
};

// ---------- 401 handler (single place) ----------
function handleUnauthorized(to) {
  const next = encodeURIComponent(
    to ||
      (typeof window !== 'undefined'
        ? window.location.pathname + window.location.search
        : '/')
  );
  const target = `/login?next=${next}`;
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign(target);
  }
}

// ---------- Core fetch wrappers ----------
async function coreFetch(
  path,
  { method = 'GET', params, body, headers, timeoutMs, rawBody } = {}
) {
  const url = BASE + path + toQS(params);
  const isFormData = body instanceof FormData;

  const init = {
    method,
    credentials: 'include',
    headers: isFormData
      ? headers || {}
      : {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(headers || {}),
        },
    body: isFormData ? body : body ? JSON.stringify(body) : rawBody ?? undefined,
    signal: withTimeout(timeoutMs),
  };

  const res = await fetch(url, init);

  if (res.status === 401) {
    const err = new Error('unauthenticated');
    err.status = 401;
    throw err;
  }

  if (res.status === 204) return { status: 204, data: null, res };

  const ct = res.headers.get('content-type') || '';
  const data = isJSON(ct) ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return { status: res.status, data, res };
}

async function request(path, opts) {
  const { data } = await coreFetch(path, opts);
  return data;
}

async function requestAxios(method, path, { params, body, headers, timeoutMs } = {}) {
  const { data, status, res } = await coreFetch(path, { method, params, body, headers, timeoutMs });
  return { data, status, res };
}

// ---------- /api/me cache ----------
let _me = null;
let _meInflight = null;

export async function getMe(opts = { redirectOn401: false }) {
  if (_me) return _me;
  if (_meInflight) return _meInflight;

  _meInflight = request('/api/me', { method: 'GET' })
    .then((u) => {
      _me = u || null;
      return _me;
    })
    .catch((e) => {
      _me = null;
      if (opts.redirectOn401 && e?.status === 401) handleUnauthorized();
      return null;
    })
    .finally(() => {
      _meInflight = null;
    });

  return _meInflight;
}

export function clearMeCache() {
  _me = null;
}

// ---------- Paywall helpers ----------
export function isPaidOrAdmin(user) {
  if (!user) return false;
  return user.role === 'admin' || !!user.isLifetime;
}

export async function ensurePaidOrAdminClient(toPath = '/checkout') {
  const me = await getMe();
  if (!isPaidOrAdmin(me)) {
    if (typeof window !== 'undefined') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`${toPath}?next=${next}&reason=payment_required`);
    }
    throw new Error('payment_required');
  }
  return me;
}

// ---------- High-level API ----------
const api = {
  // axios-like
  get:    (path, opts = {})        => requestAxios('GET',    path, opts),
  post:   (path, body, headers)    => requestAxios('POST',   path, { body, headers }),
  patch:  (path, body, headers)    => requestAxios('PATCH',  path, { body, headers }),
  delete: (path, opts = {})        => requestAxios('DELETE', path, opts),

  // OAuth redirect URLs
  googleAuthUrl:   `${BASE}/auth/google`,
  facebookAuthUrl: `${BASE}/auth/facebook`,

  // Auth/session
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Profiles (paywalled on server)
  getMiniProfile:  (userId) => request(`/api/users/${userId}/mini`),
  getMyProfile:    () => request('/api/me/full'),
  updateMyProfile: (data) => request('/api/me', { method: 'PATCH', body: data }),

  uploadMyPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return request('/api/me/photo', { method: 'POST', body: form });
  },

  // Gematria (paywalled server-side)
  getGematrias:    () => request('/api/gematrias'),
  createGematria:  (payload) => request('/api/gematrias', { method: 'POST', body: payload }),

  // Entries (paywalled server-side)
  createEntry:     (payload) => request('/api/entries', { method: 'POST', body: payload }),
  myEntries:       () => request('/api/my-entries'),
  setEntryVisibility: (id, visibility) =>
    request(`/api/entries/${id}/visibility`, { method: 'PATCH', body: { visibility } }),

  // NEW: Delete entry (owner only)
  deleteEntry: (id) =>
    request(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // NEW: Publish all private entries (bulk)
  publishAllEntries: () =>
    request('/api/entries/publish-all', { method: 'POST' }),

  // Public search (no auth)
  searchPublic: (params) => request(`/api/search${toQS(params)}`),

  // Checkout (auth required but not paywalled)
  createCheckoutSession: () => request('/api/create-checkout-session', { method: 'POST' }),
};

export default api;

// Optional named re-exports
export const {
  get, post, patch, delete: del, googleAuthUrl, facebookAuthUrl,
} = api;

// ---------- Convenience: buildUrl for components that need it ----------
export function buildUrl(path, params) {
  return BASE + path + toQS(params);
}



