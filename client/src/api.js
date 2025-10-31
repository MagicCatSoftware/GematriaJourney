// client/src/api.js
const BASE = import.meta.env.VITE_SERVER_URL || ''; // e.g. '' (same origin) or 'https://set-dec.com'

// ---------- Low-level helpers ----------
function buildUrl(path, params) {
  const qs = params ? new URLSearchParams(params).toString() : '';
  return qs ? `${BASE}${path}?${qs}` : `${BASE}${path}`;
}

// Your original "request" helper (returns parsed data directly)
async function request(path, opts = {}) {
  const isFormData = opts.body instanceof FormData;
  const headers =
    isFormData
      ? (opts.headers || {}) // let browser set multipart boundary
      : { 'Content-Type': 'application/json', ...(opts.headers || {}) };

  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers,
    ...opts,
  });

  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

// Your original "json" helper (returns parsed data directly)
async function json(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && data.error) || res.statusText || 'Request failed');
  return data;
}

// Axios-like wrapper that returns { data }
async function requestAxios(method, path, { params, body, headers } = {}) {
  const isFormData = body instanceof FormData;
  const res = await fetch(buildUrl(path, params), {
    method,
    credentials: 'include',
    headers: isFormData ? headers : body ? { 'Content-Type': 'application/json', ...(headers || {}) } : headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return { data };
}

// ---------- Named exports used elsewhere ----------
export async function getMe() {
  // Server should implement: GET /api/me
  // returns 401 if unauthenticated
  return request('/api/me', { method: 'GET' });
}

// ---------- High-level API (axios-like & convenience) ----------
const api = {
  // ----- axios-like methods (used by Admin.vue) -----
  get:    (path, opts = {})          => requestAxios('GET',    path, { params: opts.params, headers: opts.headers }),
  post:   (path, body, headers)      => requestAxios('POST',   path, { body, headers }),
  patch:  (path, body, headers)      => requestAxios('PATCH',  path, { body, headers }),
  delete: (path, opts = {})          => requestAxios('DELETE', path, { params: opts.params, headers: opts.headers }),

  // ----- auth redirect URLs (full-page redirects) -----
  googleAuthUrl:   `${BASE}/auth/google`,
  facebookAuthUrl: `${BASE}/auth/facebook`,

  // ----- convenience endpoints returning data directly -----
  getGematrias:          ()             => request('/api/gematrias'),
  createGematria:        (payload)      => request('/api/gematrias', { method: 'POST', body: JSON.stringify(payload) }),

  createEntry:           (payload)      => request('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
  myEntries:             ()             => request('/api/my-entries'),

  searchPublic:          (params)       => request('/api/search' + (params ? `?${new URLSearchParams(params)}` : '')),

  setEntryVisibility:    (id, visibility) =>
    request(`/api/entries/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    }),

  logout() { // POST /api/auth/logout
    return json('POST', '/api/auth/logout');
  },

  getMiniProfile:        (userId)       => request(`/api/users/${userId}/mini`),
  getMyProfile:          ()             => request(`/api/me/full`),
  updateMyProfile:       (data)         => request(`/api/me`, { method: 'PATCH', body: JSON.stringify(data) }),

  uploadMyPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    // No manual Content-Type for FormData
    return fetch(`${BASE}/api/me/photo`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(async (r) => {
      const ct = r.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await r.json().catch(() => ({})) : await r.text();
      if (!r.ok) {
        const message = (data && (data.error || data.message)) || `${r.status} ${r.statusText}`;
        throw new Error(message);
      }
      return data;
    });
  },

  createCheckoutSession: () => request('/api/create-checkout-session', { method: 'POST' }),
};

export default api;

// Optional named re-exports if you like importing individually
export const { get, post, patch, delete: del, googleAuthUrl, facebookAuthUrl } = api;

