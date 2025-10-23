<template>
  <div class="card">
    <h2>Public Search</h2>
    <form class="search" @submit.prevent="run">
      <input class="input" v-model="q" placeholder="Search phrase (public entries only)" />
      <button class="btn">Search</button>
    </form>

    <div v-if="loading" class="muted">Searching…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div class="results" v-else>
      <div v-if="results.length === 0" class="muted">No results.</div>
      <div v-for="r in results" :key="r._id" class="item">
        <div class="top">
          <strong>"{{ r.phrase }}"</strong>
          <span class="val">= {{ r.result }}</span>
        </div>
        <div class="meta">
          <span>Gematria: {{ r.gematria?.name || '—' }}</span>
          <span>By: {{ r.owner?.name || r.owner?.email || 'Anon' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import api from '../api';

const q = ref('');
const results = ref([]);
const loading = ref(false);
const error = ref('');

async function run() {
  loading.value = true; error.value = '';
  try {
    results.value = await api.searchPublic(q.value ? { phrase: q.value } : {});
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.search { display:flex; gap:.5rem; margin-bottom: .75rem; }
.input { flex:1; padding:.55rem .7rem; border:1px solid #ddd; border-radius:.5rem; }
.btn { padding:.6rem 1rem; border-radius:.6rem; background:#111; color:#fff; }
.results .item { border:1px solid #eee; border-radius:.6rem; padding:.75rem; margin-bottom:.6rem; }
.top { display:flex; justify-content:space-between; align-items:center; }
.val { font-weight:700; }
.meta { color:#666; font-size:.9rem; display:flex; gap:.75rem; margin-top:.25rem; }
.card { padding:1rem; border:1px solid #eee; border-radius:.8rem; }
.error { color:#b00020; }
.muted { color:#777; }
</style>
