<template>
  <div class="card">
    <h2>New Entry</h2>

    <form @submit.prevent="submit">
      <!-- Which Gematria the server will use when saving -->
      <div class="field">
        <label>Gematria (used for saving)</label>
        <select v-model="gematriaId" class="input" required>
          <option disabled value="">Select a gematria</option>
          <option v-for="g in gematrias" :key="g._id" :value="g._id">{{ g.name }}</option>
        </select>
        <div class="hint">
          Live previews are for your reference; the saved result is recomputed on the server with the selected gematria above.
        </div>
      </div>

      <!-- Phrase -->
      <div class="field">
        <label>Phrase</label>
        <input
          v-model="phrase"
          class="input"
          placeholder="Type your phrase…"
          autocomplete="off"
          spellcheck="false"
          required
        />
      </div>

      <!-- Visibility -->
      <div class="field">
        <label>Visibility</label>
        <select v-model="visibility" class="input">
          <option value="private">Private (encrypted)</option>
          <option value="public">Public</option>
        </select>
      </div>

      <!-- Live calculators -->
      <div class="grid">
        <div class="calc-card">
          <div class="calc-head">
            <strong>Simple</strong>
            <span class="muted">(A=1…Z=26)</span>
          </div>
          <div class="calc-total">{{ simple.total }}</div>
          <button class="link" type="button" @click="toggle('simple')">
            {{ show.simple ? 'Hide' : 'Show' }} breakdown
          </button>
          <ul v-if="show.simple" class="list">
            <li v-for="(it, i) in simple.items" :key="'s'+i">
              <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
            </li>
          </ul>
        </div>

        <div class="calc-card">
          <div class="calc-head">
            <strong>English</strong>
            <span class="muted">(A=6…Z=156)</span>
          </div>
          <div class="calc-total">{{ english.total }}</div>
          <button class="link" type="button" @click="toggle('english')">
            {{ show.english ? 'Hide' : 'Show' }} breakdown
          </button>
          <ul v-if="show.english" class="list">
            <li v-for="(it, i) in english.items" :key="'e'+i">
              <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
            </li>
          </ul>
        </div>

        <div class="calc-card">
          <div class="calc-head">
            <strong>Hebrew</strong>
            <span class="muted">(A=1…Z=900, your mapping)</span>
          </div>
          <div class="calc-total">{{ hebrew.total }}</div>
          <button class="link" type="button" @click="toggle('hebrew')">
            {{ show.hebrew ? 'Hide' : 'Show' }} breakdown
          </button>
          <ul v-if="show.hebrew" class="list">
            <li v-for="(it, i) in hebrew.items" :key="'h'+i">
              <code>{{ it[0] }}</code> = <b>{{ it[1] }}</b>
            </li>
          </ul>
        </div>
      </div>

      <button class="btn" :disabled="submitting || !gematriaId || !phrase.trim()">
        {{ submitting ? 'Saving…' : 'Create Entry' }}
      </button>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="ok" class="ok">Saved!</p>
    </form>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, reactive } from 'vue';
import api from '../api';
import { SYSTEMS, breakdownByMap } from '../Gematria.js';

const gematrias = ref([]);
const gematriaId = ref('');
const phrase = ref('');
const visibility = ref('private');

const submitting = ref(false);
const error = ref('');
const ok = ref(false);

// show/hide per-system breakdowns
const show = reactive({ simple: false, english: false, hebrew: false });
function toggle(key) { show[key] = !show[key]; }

onMounted(async () => {
  gematrias.value = await api.getGematrias();
});

// Live computed breakdowns/totals
const simple  = computed(() => breakdownByMap(phrase.value, SYSTEMS.simple.map,  SYSTEMS.simple.filter));
const english = computed(() => breakdownByMap(phrase.value, SYSTEMS.english.map, SYSTEMS.english.filter));
const hebrew  = computed(() => breakdownByMap(phrase.value, SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter));

async function submit() {
  error.value = ''; ok.value = false; submitting.value = true;
  try {
    await api.createEntry({
      gematriaId: gematriaId.value,
      phrase: phrase.value,
      visibility: visibility.value
    });
    ok.value = true;
    // Keep phrase for continued exploration; or uncomment to clear:
    // phrase.value = '';
  } catch (e) {
    error.value = e.message || 'Failed to save';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.field { margin-bottom: .9rem; }
.input { width: 100%; padding: .55rem .7rem; border: 1px solid #ddd; border-radius: .5rem; }
.hint { color: #666; font-size: .85rem; margin-top: .25rem; }

.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin: 1rem 0; }
.calc-card { border: 1px solid #eee; border-radius: .7rem; padding: .8rem; background: #fff; }
.calc-head { display: flex; align-items: baseline; gap: .5rem; }
.calc-total { font-size: 1.8rem; font-weight: 800; margin: .4rem 0 .2rem; }
.list { list-style: none; padding-left: 0; margin: .4rem 0 0; }
.list li { display: flex; gap: .4rem; align-items: center; }
.link { margin-top: .3rem; padding: 0; background: none; border: none; color: #1d3bc1; cursor: pointer; }

.btn { margin-top: .75rem; padding: .6rem 1rem; border-radius: .6rem; background: #111; color: #fff; }
.error { color: #b00020; margin-top: .5rem; }
.ok { color: #0a7a28; margin-top: .5rem; }
.card { padding: 1rem; border: 1px solid #eee; border-radius: .8rem; background: #fff; }
.muted { color: #666; }
</style>
