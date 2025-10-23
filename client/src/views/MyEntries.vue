<template>
  <div class="card">
    <h2>My Entries</h2>

    <div v-if="loading" class="muted">Loading…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else>
      <div v-if="entries.length === 0" class="muted">No entries yet.</div>

      <div class="list">
        <div class="item" v-for="e in entries" :key="e._id">
          <div class="row">
            <strong>{{ e.gematria?.name || '—' }}</strong>
            <span class="tag" :class="e.visibility">{{ e.visibility }}</span>
          </div>

          <div v-if="e.visibility === 'public'">
            <div class="phrase">"{{ e.phrase }}"</div>
            <div class="result">= {{ e.result }}</div>
          </div>
          <div v-else>
            <div v-if="e.decrypted">
              <div class="phrase">"{{ e.decrypted.phrase }}"</div>
              <div class="result">= {{ e.decrypted.result }}</div>
            </div>
            <div v-else class="muted">Unable to decrypt.</div>
          </div>

          <div class="muted small">{{ new Date(e.createdAt).toLocaleString() }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '../api';

const entries = ref([]);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    entries.value = await api.myEntries();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.list { display:grid; gap:.75rem; margin-top:.75rem; }
.item { border:1px solid #eee; border-radius:.6rem; padding:.75rem; }
.row { display:flex; align-items:center; justify-content:space-between; }
.tag { padding:.1rem .5rem; border-radius:.4rem; font-size:.8rem; }
.tag.public { background:#e8f7ee; color:#0a7a28; }
.tag.private { background:#eef2ff; color:#1d3bc1; }
.phrase { font-size:1.05rem; }
.result { font-weight:700; }
.muted { color:#777; }
.small { font-size:.85rem; }
.card { padding:1rem; border:1px solid #eee; border-radius:.8rem; }
.error { color:#b00020; }
</style>
