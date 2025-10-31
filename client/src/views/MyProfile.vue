<template>
  <section class="card">
    <h2>My Profile</h2>
    <div v-if="loading" class="muted">Loading…</div>
    <div v-else>
      <form @submit.prevent="save">
        <div class="row">
          <div class="photo">
            <img :src="preview || me.photoUrl || fallback" class="avatar" alt="" />
            <input type="file" accept="image/*" @change="onPick" />
            <button class="btn small" :disabled="uploading || !file" @click.prevent="upload">
              {{ uploading ? 'Uploading…' : 'Upload Photo' }}
            </button>
          </div>
          <div class="fields">
            <div class="field">
              <label>Name</label>
              <input v-model="form.name" class="input" />
            </div>
            <div class="field">
              <label>Bio</label>
              <textarea v-model="form.bio" class="input" rows="4" placeholder="Tell people about your research…"></textarea>
            </div>
            <div class="muted small">Email: {{ me.email }}</div>
          </div>
        </div>

        <button class="btn" :disabled="saving">{{ saving ? 'Saving…' : 'Save Changes' }}</button>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="ok" class="ok">Saved!</p>
      </form>
    </div>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import api from '../api';

const loading = ref(true);
const saving = ref(false);
const uploading = ref(false);
const error = ref('');
const ok = ref(false);

const me = reactive({ name: '', email: '', photoUrl: '', bio: '' });
const form = reactive({ name: '', bio: '' });

const file = ref(null);
const preview = ref('');
const fallback = 'https://avatars.githubusercontent.com/u/0?v=4';

function onPick(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  file.value = f;
  preview.value = URL.createObjectURL(f);
}

async function upload() {
  if (!file.value) return;
  uploading.value = true; error.value = '';
  try {
    const res = await api.uploadMyPhoto(file.value);
    me.photoUrl = res.photoUrl;
    preview.value = '';
    file.value = null;
  } catch (e) {
    error.value = e.message || 'Upload failed';
  } finally {
    uploading.value = false;
  }
}

async function save() {
  saving.value = true; error.value = ''; ok.value = false;
  try {
    await api.updateMyProfile({ name: form.name, bio: form.bio });
    me.name = form.name; me.bio = form.bio; ok.value = true;
  } catch (e) {
    error.value = e.message || 'Save failed';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    const data = await api.getMyProfile();
    Object.assign(me, data || {});
    form.name = me.name || '';
    form.bio = me.bio || '';
  } catch (e) {
    error.value = e.message || 'Failed to load profile';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* --- CARD / PANEL --- */
.card {
  position: relative;
  background: #0b0b0b;               /* deep charcoal to match site */
  border: 1px solid #1f1f1f;
  border-radius: 14px;
  padding: 1rem;
  color: var(--fg);
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.02) inset,
    0 6px 20px rgba(0,0,0,0.35);
}
.card::after {                        /* faint chalk speckle */
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .05;
  background:
    radial-gradient(1px 1px at 20% 35%, #fff 20%, transparent 21%),
    radial-gradient(1px 1px at 75% 65%, #fff 18%, transparent 19%),
    radial-gradient(1px 1px at 45% 80%, #fff 14%, transparent 15%);
  mix-blend-mode: screen;
  border-radius: 14px;
}

/* --- LAYOUT --- */
.row { display:flex; gap:1.1rem; align-items:flex-start; }
@media (max-width: 800px) { .row { flex-direction: column; } }

/* --- PHOTO BLOCK --- */
.photo { display:flex; flex-direction:column; gap:.6rem; align-items:center; }

.avatar {
  width:120px; height:120px; border-radius:50%; object-fit:cover;
  border: 1px dashed rgba(255,255,255,.35);
  box-shadow:
    0 0 0 1px rgba(255,255,255,.10) inset,
    0 1px 0 rgba(255,255,255,.06);
  background:#0f0f0f;
}

/* Style the native file input to fit the theme */
.photo input[type="file"] {
  font-size:.9rem;
  color: var(--fg);
  background:#101010;
  border:1px solid #2a2a2a;
  border-radius:.55rem;
  padding:.45rem .6rem;
  width: 100%;
}
.photo input[type="file"]::file-selector-button {
  margin-right:.6rem;
  padding:.4rem .7rem;
  border: 2px dashed rgba(255,255,255,.65);
  border-radius:.5rem;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}
.photo input[type="file"]:focus-visible {
  outline: 2px solid rgba(255,255,255,.9);
  outline-offset: 2px;
  border-radius:.5rem;
}

/* --- FIELDS --- */
.fields { flex:1; }
.field { margin-bottom:.9rem; }
label { display:block; margin-bottom:.35rem; color: var(--fg); opacity:.95; }

.input, textarea.input {
  width:100%;
  padding:.6rem .75rem;
  background:#101010;
  border:1px solid #2a2a2a;
  border-radius:.6rem;
  color:var(--fg);
  transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
}
.input::placeholder { color: var(--muted); }
.input:focus,
textarea.input:focus {
  outline:none;
  border-color:#555;
  box-shadow: 0 0 0 2px rgba(255,255,255,.06);
  background:#111;
}

/* --- BUTTONS --- */
.btn {
  padding:.55rem .95rem; border-radius:.7rem;
  background: transparent; color: var(--fg);
  outline: 2px dashed rgba(255,255,255,.7);
  outline-offset: -4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,.12) inset;
  transition: background .15s ease, transform .15s ease, opacity .15s ease;
}
.btn:hover { background: rgba(255,255,255,.06); transform: translateY(-1px); }
.btn.small { padding:.38rem .65rem; font-size:.9rem; border-radius:.55rem; }

.btn:disabled,
[disabled].btn { opacity:.55; cursor:not-allowed; transform:none; }

/* --- STATUS TEXT --- */
.muted { color: var(--muted); }
.small { font-size:.9rem; }
.error { color:#ff6b8b; margin-top:.55rem; }
.ok    { color:#69f0a8; margin-top:.55rem; }

/* --- ACCESSIBILITY --- */
.input:focus-visible,
.btn:focus-visible {
  outline: 2px solid rgba(255,255,255,.95);
  outline-offset: 2px;
  border-radius:.5rem;
}

/* --- REDUCED MOTION --- */
@media (prefers-reduced-motion: reduce) {
  .btn, .input { transition: none; }
}
</style>

