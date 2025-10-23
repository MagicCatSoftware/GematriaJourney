<template>
  <div class="card">
    <h2>Lifetime Membership</h2>
    <p>$20 one-time. Unlock advanced searches forever.</p>
    <button class="btn" :disabled="loading" @click="go">
      {{ loading ? 'Opening Stripe…' : 'Checkout with Stripe' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import api from '../api';
import { ref } from 'vue';

const loading = ref(false);
const error = ref('');

async function go() {
  loading.value = true; error.value = '';
  try {
    const { url } = await api.createCheckoutSession();
    window.location.href = url;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.card { max-width:520px; margin:2rem auto; padding:1rem; border:1px solid #eee; border-radius:.8rem; }
.btn { margin-top:.75rem; padding:.6rem 1rem; border-radius:.6rem; background:#111; color:#fff; }
.error { color:#b00020; }
</style>
