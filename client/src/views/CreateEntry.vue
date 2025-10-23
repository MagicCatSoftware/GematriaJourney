<template>
  <div class="card">
    <h2>New Entry</h2>
    <form @submit.prevent="submit">
      <div class="field">
        <label>Gematria</label>
        <select v-model="gematriaId" class="input">
          <option disabled value="">Select a gematria</option>
          <option v-for="g in gematrias" :key="g._id" :value="g._id">{{ g.name }}</option>
        </select>
      </div>

      <div class="field">
        <label>Phrase</label>
        <input v-model="phrase" class="input" placeholder="Enter phrase" required />
      </div>

      <div class="field">
        <label>Visibility</label>
        <select v-model="visibility" class="input">
          <option value="private">Private (encrypted)</option>
          <option value="public">Public</option>
        </select>
      </div>

      <button class="btn" :disabled="submitting">{{ submitting ? 'Saving…' : 'Create Entry' }}</button>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="ok" class="ok">Saved!</p>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '../api';

const gematrias = ref([]);
const gematriaId = ref('');
const phrase = ref('');
const visibility = ref('private');
const submitting = ref(false);
const error = ref('');
const ok = ref(false);

onMounted(async () => {
  gematrias.value = await api.getGematrias();
});

async function submit() {
  submitting.value = true; error.value = ''; ok.value = false;
  try {
    await api.createEntry({ gematriaId: gematriaId.value, phrase: phrase.value, visibility: visibility.value });
    ok.value = true; phrase.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.field { margin-bottom:.75rem; }
.input { width:100%; padding:.55rem .7rem; border:1px solid #ddd; border-radius:.5rem; }
.btn { margin-top:1rem; padding:.6rem 1rem; border-radius:.6rem; background:#111; color:#fff; }
.error { color:#b00020; }
.ok { color:#0a7a28; }
.card { padding:1rem; border:1px solid #eee; border-radius:.8rem; }
</style>
