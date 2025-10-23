const BASE = import.meta.env.VITE_SERVER_URL;

async function request(path, opts = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function getMe() {
  // add this endpoint on server: app.get('/api/me', (req,res)=> req.user? res.json({id:req.user._id, name:req.user.name, email:req.user.email, isLifetime:req.user.isLifetime}): res.status(401).json({error:'unauth'}));
  return request('/api/me', { method: 'GET' });
}

export const api = {
  // auth urls for full-page redirects:
  googleAuthUrl: BASE + '/auth/google',
  facebookAuthUrl: BASE + '/auth/facebook',

  getGematrias: () => request('/api/gematrias'),
  createGematria: (payload) => request('/api/gematrias', { method: 'POST', body: JSON.stringify(payload) }),

  createEntry: (payload) => request('/api/entries', { method: 'POST', body: JSON.stringify(payload) }),
  myEntries: () => request('/api/my-entries'),

  searchPublic: (params) => {
    const q = new URLSearchParams(params || {}).toString();
    return request('/api/search' + (q ? `?${q}` : ''));
  },

  setEntryVisibility: (id, visibility) =>
    request(`/api/entries/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    }),

      getMiniProfile: (userId) => request(`/api/users/${userId}/mini`),
  getMyProfile:   () => request(`/api/me/full`),
  updateMyProfile: (data) =>
    request(`/api/me`, { method: 'PATCH', body: JSON.stringify(data) }),
  uploadMyPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return fetch((import.meta.env.VITE_SERVER_URL || '') + `/api/me/photo`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    }).then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    });
  },

  createCheckoutSession: () => request('/api/create-checkout-session', { method: 'POST' }),
};

export default api;
