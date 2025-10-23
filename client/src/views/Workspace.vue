<template>
  <div class="layout">
    <!-- LEFT: Create Entry + My Entries -->
    <section class="card">
      <div class="head">
        <h2>Create Entry</h2>
        <span class="muted small">Type a phrase to see live values before saving.</span>
      </div>

      <form @submit.prevent="saveEntry">
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

        <div class="field">
          <label>Gematria (used when saving)</label>
          <select v-model="gematriaId" class="input" required>
            <option disabled value="">Select a gematria</option>
            <option v-for="g in gematrias" :key="g._id" :value="g._id">
              {{ g.name }}
            </option>
          </select>
          <div class="hint">The server recomputes the result using your selected gematria when you save.</div>
        </div>

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
              <span class="muted">(A=1…Z=900)</span>
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

        <button class="btn" :disabled="savingEntry || !gematriaId || !phrase.trim()">
          {{ savingEntry ? 'Saving…' : 'Create Entry' }}
        </button>
        <p v-if="entryError" class="error">{{ entryError }}</p>
        <p v-if="entryOk" class="ok">Entry saved!</p>
      </form>

      <hr class="sep" />

      <div class="head">
        <h2>My Entries</h2>
        <span class="muted small" v-if="entriesLoading">Loading…</span>
      </div>

      <div v-if="entriesError" class="error">{{ entriesError }}</div>
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

            <!-- Publish / Private toggle -->
            <div class="actions">
              <button
                class="btn tiny"
                :disabled="togglingId === e._id"
                @click="togglePublish(e)"
                :title="e.visibility === 'public' ? 'Make Private (will encrypt)' : 'Publish (will decrypt & expose phrase/result)'"
              >
                {{ e.visibility === 'public' ? 'Make Private' : 'Publish' }}
              </button>
            </div>

            <div class="muted small">{{ new Date(e.createdAt).toLocaleString() }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- RIGHT: Gematrias + Create Gematria -->
    <section class="card">
      <div class="head">
        <h2>Gematrias</h2>
        <button class="btn small ghost" @click="refreshGematrias" :disabled="gLoading">
          {{ gLoading ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>

      <div v-if="gError" class="error">{{ gError }}</div>
      <div v-else>
        <div v-if="gematrias.length === 0" class="muted">No gematrias yet.</div>
        <ul class="gem-list" v-else>
          <li v-for="g in gematrias" :key="g._id">
            <span class="name">{{ g.name }}</span>
            <button class="link" type="button" @click="selectGematria(g._id)">Use for entry</button>
          </li>
        </ul>
      </div>

      <hr class="sep" />

      <h3>Create Gematria</h3>
      <form @submit.prevent="createGem">
        <div class="field">
          <label>Name</label>
          <input v-model="gemName" class="input" placeholder="e.g., My Custom System" required />
        </div>

        <div class="letters">
          <div v-for="l in letters" :key="l" class="cell">
            <label>{{ l.toUpperCase() }}</label>
            <input type="number" class="input" v-model.number="vals[l]" required />
          </div>
        </div>

        <button class="btn" :disabled="creatingGem">{{ creatingGem ? 'Saving…' : 'Create Gematria' }}</button>
        <p v-if="gemError" class="error">{{ gemError }}</p>
        <p v-if="gemOk" class="ok">Gematria created and selected!</p>
      </form>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref, reactive, computed } from 'vue';
import api from '../api';
import { SYSTEMS, breakdownByMap } from '../gematria';

// ---------- ENTRY FORM ----------
const phrase = ref('');
const gematriaId = ref('');
const visibility = ref('private');

const savingEntry = ref(false);
const entryError = ref('');
const entryOk = ref(false);

// live totals/breakdowns
const show = reactive({ simple: false, english: false, hebrew: false });
const toggle = (k) => (show[k] = !show[k]);

const simple  = computed(() => breakdownByMap(phrase.value, SYSTEMS.simple.map,  SYSTEMS.simple.filter));
const english = computed(() => breakdownByMap(phrase.value, SYSTEMS.english.map, SYSTEMS.english.filter));
const hebrew  = computed(() => breakdownByMap(phrase.value, SYSTEMS.hebrew.map,  SYSTEMS.hebrew.filter));

async function saveEntry() {
  entryError.value = ''; entryOk.value = false; savingEntry.value = true;
  try {
    await api.createEntry({ gematriaId: gematriaId.value, phrase: phrase.value, visibility: visibility.value });
    entryOk.value = true;
    await loadEntries(); // refresh list
    // keep phrase for exploration, or uncomment to clear:
    // phrase.value = '';
  } catch (e) {
    entryError.value = e.message || 'Failed to save entry';
  } finally {
    savingEntry.value = false;
  }
}

// ---------- LISTS ----------
const entries = ref([]);
const entriesLoading = ref(true);
const entriesError = ref('');

async function loadEntries() {
  entriesLoading.value = true; entriesError.value = '';
  try {
    entries.value = await api.myEntries();
  } catch (e) {
    entriesError.value = e.message || 'Failed to load entries';
  } finally {
    entriesLoading.value = false;
  }
}

// publish toggle state/handler
const togglingId = ref(null);
async function togglePublish(e) {
  try {
    togglingId.value = e._id;
    const target = e.visibility === 'public' ? 'private' : 'public';
    await api.setEntryVisibility(e._id, target);  // requires client api helper + server PATCH route
    await loadEntries();
  } catch (err) {
    alert(err?.message || 'Failed to toggle visibility');
  } finally {
    togglingId.value = null;
  }
}

// ---------- GEMATRIAS ----------
const gematrias = ref([]);
const gLoading = ref(true);
const gError = ref('');

async function loadGematrias() {
  gLoading.value = true; gError.value = '';
  try {
    gematrias.value = await api.getGematrias();
  } catch (e) {
    gError.value = e.message || 'Failed to load gematrias';
  } finally {
    gLoading.value = false;
  }
}

async function refreshGematrias() {
  await loadGematrias();
}

function selectGematria(id) {
  gematriaId.value = id;
}

// ---------- CREATE GEMATRIA ----------
const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
const vals = reactive(Object.fromEntries(letters.map(l => [l, 0])));
const gemName = ref('');
const creatingGem = ref(false);
const gemError = ref('');
const gemOk = ref(false);

async function createGem() {
  creatingGem.value = true; gemError.value = ''; gemOk.value = false;
  try {
    const payload = { name: gemName.value, letters: { ...vals } };
    const created = await api.createGematria(payload);
    gemOk.value = true;

    // refresh and preselect the new gematria
    await loadGematrias();
    if (created && created._id) {
      gematriaId.value = created._id;
    } else {
      const match = gematrias.value.find(g => g.name === gemName.value);
      if (match) gematriaId.value = match._id;
    }

    // reset form
    for (const l of letters) vals[l] = 0;
    gemName.value = '';
  } catch (e) {
    gemError.value = e.message || 'Failed to create gematria';
  } finally {
    creatingGem.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadEntries(), loadGematrias()]);
});
</script>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 1rem;
}
@media (max-width: 960px) {
  .layout { grid-template-columns: 1fr; }
}

.card { background:#fff; border:1px solid #eee; border-radius:.8rem; padding:1rem; }
.head { display:flex; align-items:center; justify-content:space-between; gap:.75rem; margin-bottom:.5rem; }

.field { margin-bottom:.9rem; }
.input { width:100%; padding:.55rem .7rem; border:1px solid #ddd; border-radius:.5rem; }
.hint { color:#666; font-size:.85rem; margin-top:.25rem; }

.grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:1rem; margin:1rem 0; }
.calc-card { border:1px solid #eee; border-radius:.7rem; padding:.8rem; background:#fff; }
.calc-head { display:flex; align-items:baseline; gap:.5rem; }
.calc-total { font-size:1.8rem; font-weight:800; margin:.4rem 0 .2rem; }
.list { list-style:none; padding-left:0; margin:.4rem 0 0; }
.list li { display:flex; gap:.4rem; align-items:center; }
.link { margin-top:.3rem; padding:0; background:none; border:none; color:#1d3bc1; cursor:pointer; }

.sep { margin:1rem 0; border:none; border-top:1px solid #eee; }

.list .item { border:1px solid #eee; border-radius:.6rem; padding:.75rem; }
.row { display:flex; align-items:center; justify-content:space-between; }
.tag { padding:.1rem .5rem; border-radius:.4rem; font-size:.8rem; }
.tag.public { background:#e8f7ee; color:#0a7a28; }
.tag.private { background:#eef2ff; color:#1d3bc1; }
.phrase { font-size:1.05rem; }
.result { font-weight:700; }
.actions { margin-top:.5rem; display:flex; gap:.5rem; }
.btn.tiny { padding:.25rem .5rem; font-size:.85rem; border-radius:.4rem; background:#111; color:#fff; }

.muted { color:#777; }
.small { font-size:.88rem; }
.error { color:#b00020; }
.ok { color:#0a7a28; }

.gem-list { list-style:none; padding:0; margin:0 0 1rem 0; display:grid; gap:.4rem; }
.gem-list li { display:flex; align-items:center; justify-content:space-between; gap:.5rem; }
.gem-list .name { font-weight:600; }

.btn { padding:.6rem 1rem; border-radius:.6rem; background:#111; color:#fff; }
.btn.small { padding:.35rem .6rem; font-size:.9rem; }
.btn.ghost { background:transparent; border:1px solid #111; color:#111; }
</style>
