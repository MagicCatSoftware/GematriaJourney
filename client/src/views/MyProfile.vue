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
.card { background:#fff; border:1px solid #eee; border-radius:.8rem; padding:1rem; }
.row { display:flex; gap:1rem; align-items:flex-start; }
@media (max-width: 800px) { .row { flex-direction: column; } }
.photo { display:flex; flex-direction:column; gap:.5rem; align-items:center; }
.avatar { width:120px; height:120px; border-radius:50%; object-fit:cover; border:1px solid #eee; }
.fields { flex:1; }
.field { margin-bottom:.75rem; }
.input { width:100%; padding:.55rem .7rem; border:1px solid #ddd; border-radius:.5rem; }
.btn { padding:.5rem .9rem; border-radius:.6rem; background:#111; color:#fff; }
.btn.small { padding:.35rem .6rem; font-size:.9rem; }
.muted { color:#777; }
.small { font-size:.88rem; }
.error { color:#b00020; margin-top:.5rem; }
.ok { color:#0a7a28; margin-top:.5rem; }
</style>
