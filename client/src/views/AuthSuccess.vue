<template>
  <div class="card">
    <h2>Finishing sign-in…</h2>
    <p v-if="loading">Checking your session…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <pre v-else class="ok">Welcome {{ me?.name || me?.email }} — redirecting…</pre>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { getMe } from '../api';

const router = useRouter();
const route = useRoute();

const loading = ref(true);
const error = ref('');
const me = ref(null);

onMounted(async () => {
  try {
    // IMPORTANT: this call must include cookies; api.js already sets credentials:'include'
    me.value = await getMe();           // 200 → logged in
    const next = route.query.next || '/';
    router.replace(String(next));
  } catch (e) {
    error.value = `Not signed in (${e?.status || ''}): ${e?.message || 'Unknown error'}`;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.error { color:#b00020; white-space: pre-wrap; }
.ok { color:#0a7a28; background:#f6fff8; padding:.6rem; border-radius:.5rem; }
.card { max-width:540px; margin:2rem auto; padding:1rem; border:1px solid #eee; border-radius:.8rem; }
</style>
