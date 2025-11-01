<!-- client/src/views/Admin.vue -->
<template>
  <section class="container admin">
    <h1>Admin</h1>

    <div class="cards">
      <div class="card">
        <div class="card__head">
          <h2>Overview</h2>
          <button class="btn" @click="loadAll">Refresh</button>
        </div>

        <div v-if="errors.overview" class="error">{{ errors.overview }}</div>
        <div class="grid stats" v-else>
          <div class="stat"><div class="num">{{ overview.users }}</div><div class="lbl">Users</div></div>
          <div class="stat"><div class="num">{{ overview.banned }}</div><div class="lbl">Banned</div></div>
          <div class="stat"><div class="num">{{ overview.gematrias }}</div><div class="lbl">Gematrias</div></div>
          <div class="stat"><div class="num">{{ overview.entries }}</div><div class="lbl">Entries</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card__head">
          <h2>Users</h2>
          <input v-model="q" @input="debouncedLoadUsers" class="input" placeholder="Search users…" />
        </div>
        <div v-if="errors.users" class="error">{{ errors.users }}</div>
        <div class="table" v-else>
          <div class="row head">
            <div>Name</div><div>Email</div><div>Role</div><div>Status</div><div>Actions</div>
          </div>
          <div v-for="u in users" :key="u._id" class="row">
            <div>{{ u.name || '—' }}</div>
            <div>{{ u.email }}</div>
            <div>
              <select v-model="u.role" @change="setRole(u)">
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div>
              <span class="pill" :class="u.isBanned ? 'danger' : 'ok'">{{ u.isBanned ? 'banned' : 'active' }}</span>
              <span v-if="u.isLifetime" class="pill success">paid</span>
            </div>
            <div class="actions">
              <button class="btn tiny" @click="toggleBan(u)">{{ u.isBanned ? 'Unban' : 'Ban' }}</button>
              <button class="btn tiny danger" @click="delUser(u)">Delete</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card two-col">
        <div>
          <div class="card__head"><h2>Gematrias</h2></div>
          <div v-if="errors.gematrias" class="error">{{ errors.gematrias }}</div>
          <div class="table" v-else>
            <div class="row head"><div>ID</div><div>Name</div><div>Actions</div></div>
            <div v-for="g in gematrias" :key="g._id" class="row">
              <div class="mono">{{ g._id }}</div>
              <div class="clip">{{ g.name || g.phrase || '—' }}</div>
              <div class="actions"><button class="btn tiny danger" @click="delGematria(g)">Delete</button></div>
            </div>
          </div>
        </div>

        <div>
          <div class="card__head"><h2>Entries</h2></div>
          <div v-if="errors.entries" class="error">{{ errors.entries }}</div>
          <div class="table" v-else>
            <div class="row head"><div>ID</div><div>Title</div><div>Actions</div></div>
            <div v-for="e in entries" :key="e._id" class="row">
              <div class="mono">{{ e._id }}</div>
              <div class="clip">{{ e.title || e.text || e.phrase || '—' }}</div>
              <div class="actions"><button class="btn tiny danger" @click="delEntry(e)">Delete</button></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import api from '../api';

// state
const overview = ref({ users: 0, banned: 0, gematrias: 0, entries: 0 });
const users = ref([]);
const gematrias = ref([]);
const entries = ref([]);
const q = ref('');
const errors = ref({ overview: '', users: '', gematrias: '', entries: '' });

// helpers to parse various response shapes safely
function asArray(x, fallback = []) {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.items)) return x.items;
  if (x && Array.isArray(x.gematrias)) return x.gematrias;
  if (x && Array.isArray(x.entries)) return x.entries;
  if (x && Array.isArray(x.users)) return x.users;
  return fallback;
}

async function loadOverview() {
  errors.value.overview = '';
  try {
    const r = await api.get('/admin/overview');
    // expect { users, banned, gematrias, entries }
   
    overview.value = {
      users: Number(r.data?.users || 0),
      banned: Number(r.data?.banned || 0),
      gematrias: Number(r.data?.gematrias || 0),
      entries: Number(r.data?.entries || 0),
    };
  } catch (e) {
    console.error('overview error', e);
    errors.value.overview = e?.message || 'Failed to load overview';
  }
}

async function loadUsers() {
  errors.value.users = '';
  try {
    const r = await api.get('/admin/users', { params: { q: q.value } });
    // accept either { users: [...] } or [...]
    users.value = asArray(r.data);
  } catch (e) {
    console.error('users error', e);
    errors.value.users = e?.message || 'Failed to load users';
  }
}

async function loadGematrias() {
  errors.value.gematrias = '';
  try {
    // Your server: GET /api/gematrias -> returns an ARRAY
    const r = await api.get('/api/gematrias', { params: { limit: 200 } });
    gematrias.value = asArray(r.data);
  } catch (e) {
    console.error('gematrias error', e);
    errors.value.gematrias = e?.message || 'Failed to load gematrias';
  }
}

async function loadEntries() {
  errors.value.entries = '';
  try {
    // Your server: GET /api/entries -> returns { entries: [...] }
    const r = await api.get('/api/entries', { params: { limit: 200 } });
    entries.value = asArray(r.data);
  } catch (e) {
    console.error('entries error', e);
    errors.value.entries = e?.message || 'Failed to load entries';
  }
}

async function setRole(u) {
  await api.patch(`/admin/users/${u._id}/role`, { role: u.role });
}

async function toggleBan(u) {
  const ban = !u.isBanned;
  await api.patch(`/admin/users/${u._id}/ban`, { ban });
  u.isBanned = ban;
}

async function delUser(u) {
  if (!confirm(`Delete user ${u.email}? This also removes their content.`)) return;
  await api.delete(`/admin/users/${u._id}`);
  await loadUsers(); await loadOverview();
}

async function delGematria(g) {
  if (!confirm(`Delete gematria ${g._id}?`)) return;
  await api.delete(`/admin/gematrias/${g._id}`);
  await loadGematrias(); await loadOverview();
}

async function delEntry(e) {
  if (!confirm(`Delete entry ${e._id}?`)) return;
  await api.delete(`/admin/entries/${e._id}`);
  await loadEntries(); await loadOverview();
}

async function loadAll() {
  await Promise.all([loadOverview(), loadUsers(), loadGematrias(), loadEntries()]);
}

// tiny debounce for search box
let t;
function debouncedLoadUsers() {
  clearTimeout(t);
  t = setTimeout(loadUsers, 250);
}

loadAll();
</script>

<style scoped>
.container.admin { max-width: 1100px; margin: 2rem auto; }
.cards { display: grid; gap: 1rem; }
.card { background: rgba(0,0,0,.6); border: 1px solid #1f1f1f; border-radius: 14px; padding: 1rem; color: var(--fg); }
.card__head { display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom:.75rem; }
.two-col { display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.grid.stats { display:grid; grid-template-columns: repeat(4,1fr); gap:.75rem; }
.stat { background: rgba(255,255,255,.04); border: 1px dashed rgba(255,255,255,.12); border-radius: 12px; padding:.75rem; text-align:center; }
.stat .num { font-size:1.4rem; font-weight:800; }
.stat .lbl { opacity:.8; }

.table { display:grid; gap:.25rem; }
.row { display:grid; grid-template-columns: 1.6fr 1.8fr .9fr 1.1fr 1.2fr; align-items:center; gap:.5rem; padding:.5rem; border-radius:10px; }
.row.head { opacity:.75; font-weight:700; background: rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); }
.row:not(.head):hover { background: rgba(255,255,255,.04); }
.actions { display:flex; gap:.4rem; justify-content:flex-end; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size:.9rem; }
.clip { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.btn { padding:.35rem .7rem; border-radius:.6rem; background:transparent; color:var(--fg); outline:2px dashed rgba(255,255,255,.5); outline-offset:-4px; }
.btn.tiny { padding:.25rem .5rem; font-size:.85rem; }
.btn.danger { color:#ff7979; outline-color: rgba(255,120,120,.6); }
.pill { padding:.15rem .5rem; border-radius:.6rem; border:1px dashed rgba(255,255,255,.2); }
.pill.ok { color:#a7f3d0; border-color: rgba(34,197,94,.4); }
.pill.success { color:#93c5fd; border-color: rgba(59,130,246,.4); }
.pill.danger { color:#fecaca; border-color: rgba(239,68,68,.4); }

@media (max-width: 960px) {
  .two-col { grid-template-columns: 1fr; }
  .row { grid-template-columns: 1.4fr 1.6fr .9fr 1fr 1.2fr; }
}
@media (max-width: 680px) {
  .row { grid-template-columns: 1.4fr 1.6fr 1fr; }
  .row > :nth-child(3n+3) { justify-self: end; }
}
</style>
